use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::task;

#[derive(Clone, Serialize, Debug)]
pub struct ConversionProgress {
    pub id: String,
    pub frame: u64,
    pub fps: f64,
    pub time: String, // Time position in the output video (HH:MM:SS)
    pub elapsed_time: String, // Time elapsed since conversion started (HH:MM:SS)
    pub bitrate: String,
    pub speed: String,
    pub progress: f64, // 0.0 to 100.0
    pub time_remaining: Option<String>, // Estimated time remaining (HH:MM:SS)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversionOptions {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub video_codec: String,
    pub audio_track_index: Option<u32>,
    pub subtitle_track_index: Option<u32>,
    pub duration_seconds: f64,
    pub total_frames: Option<u64>, // Total number of frames in the video
    // New strategies
    pub audio_strategy: Option<String>, // "copy_all", "convert_all", "first_track"
    pub subtitle_strategy: Option<String>, // "copy_all", "burn_in", "ignore"
    pub audio_codec: Option<String>,    // "aac", "ac3", "copy"
    pub audio_bitrate: Option<String>,  // "128k"
    // Advanced Video Options
    pub crf: Option<u8>,
    pub preset: Option<String>,
    pub profile: Option<String>,
    pub tune: Option<String>,
}

pub struct ConversionManager {
    pub processes: Arc<Mutex<HashMap<String, u32>>>,
}

impl ConversionManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub async fn convert_video(
    window: Window,
    options: ConversionOptions,
    state: State<'_, ConversionManager>,
) -> Result<(), String> {
    let mut args = vec![
        "-i".to_string(),
        options.input_path.clone(),
        "-c:v".to_string(),
        options.video_codec.clone(),
    ];

    // Apply Preset (convert software presets to hardware presets if needed)
    let preset = options.preset.clone().unwrap_or_else(|| {
        if options.video_codec.contains("nvenc") {
            "p4".to_string() // Default NVENC preset (balanced)
        } else {
            "fast".to_string() // Default software preset
        }
    });
    
    // Convert software preset names to NVENC presets if using NVENC
    let final_preset = if options.video_codec.contains("nvenc") {
        match preset.as_str() {
            "ultrafast" => "p1",
            "superfast" => "p2",
            "veryfast" => "p3",
            "faster" => "p3",
            "fast" => "p4",
            "medium" => "p4",
            "slow" => "p5",
            "slower" => "p6",
            "veryslow" => "p7",
            _ => {
                // If already a p1-p7 preset, use as-is, otherwise default to p4
                if preset.starts_with('p') && preset.len() == 2 {
                    preset.as_str()
                } else {
                    "p4"
                }
            }
        }
    } else {
        preset.as_str()
    };
    
    args.push("-preset".to_string());
    args.push(final_preset.to_string());

    // Apply CRF (default to 23 if not specified, only if not using hardware accel which might use different flags, but let's try generic first)
    // Note: NVENC uses -cq for VBR, but -crf is ignored or error?
    // Actually, for simplicity, we'll assume software encoding or that the user knows what they are doing.
    // But better: if encoder is libx264/libx265, use -crf.
    if options.video_codec.contains("libx26")
        || options.video_codec == "libx264"
        || options.video_codec == "libx265"
    {
        if let Some(crf) = options.crf {
            args.push("-crf".to_string());
            args.push(crf.to_string());
        }
    } else if options.video_codec.contains("nvenc") {
        // For NVENC, use -cq if provided, otherwise default logic
        if let Some(crf) = options.crf {
            args.push("-cq".to_string());
            args.push(crf.to_string());
        }
    }

    // Apply Profile
    if let Some(profile) = &options.profile {
        args.push("-profile:v".to_string());
        args.push(profile.clone());
    }

    // Apply Tune
    if let Some(tune) = &options.tune {
        args.push("-tune".to_string());
        args.push(tune.clone());
    }

    // Map video stream first (required for video output)
    args.push("-map".to_string());
    args.push("0:v".to_string());

    // Audio Handling
    let audio_codec = options.audio_codec.clone().unwrap_or("aac".to_string());
    let audio_bitrate = options.audio_bitrate.clone().unwrap_or("128k".to_string());

    match options.audio_strategy.as_deref() {
        Some("copy_all") => {
            args.push("-map".to_string());
            args.push("0:a".to_string());
            args.push("-c:a".to_string());
            args.push("copy".to_string());
        }
        Some("convert_all") => {
            args.push("-map".to_string());
            args.push("0:a".to_string());
            args.push("-c:a".to_string());
            args.push(audio_codec.clone());
            if audio_codec != "copy" {
                args.push("-b:a".to_string());
                args.push(audio_bitrate.clone());
            }
        }
        _ => {
            // Default or "first_track" or specific index
            if let Some(index) = options.audio_track_index {
                args.push("-map".to_string());
                args.push(format!("0:{}", index));
            } else {
                // FFmpeg default behavior is usually first track, but let's be explicit if needed
                // For now, let's just set codec
            }
            args.push("-c:a".to_string());
            args.push(audio_codec);
            if options.audio_codec.as_deref() != Some("copy") {
                args.push("-b:a".to_string());
                args.push(audio_bitrate);
            }
        }
    }

    // Subtitle Handling
    match options.subtitle_strategy.as_deref() {
        Some("copy_all") => {
            args.push("-map".to_string());
            args.push("0:s".to_string());
            args.push("-c:s".to_string());

            // Check if output is MP4
            if options.output_path.to_lowercase().ends_with(".mp4") {
                // MP4 doesn't support many subtitle formats (like PGS, ASS) natively in the same way MKV does.
                // 'mov_text' is the standard text subtitle format for MP4.
                // However, this will fail for image-based subtitles (PGS/VOBSUB).
                // Ideally we should detect input codec, but for now, let's try mov_text as it's safer than copy for text subs.
                // If it's PGS, it might still fail, but 'copy' definitely fails.
                args.push("mov_text".to_string());
            } else {
                args.push("copy".to_string());
            }
        }
        Some("ignore") => {
            args.push("-sn".to_string());
        }
        _ => {
            if let Some(index) = options.subtitle_track_index {
                args.push("-map".to_string());
                args.push(format!("0:{}", index));
                args.push("-c:s".to_string());
                args.push("mov_text".to_string());
            }
        }
    }

    // Create a temporary progress file
    let progress_file = std::env::temp_dir().join(format!("ffmpeg_progress_{}.txt", options.id));
    let progress_file_str = progress_file.to_string_lossy().to_string();
    
    // Use -progress to force FFmpeg to write progress to a file
    // This is the most reliable way to get progress when stderr is not a TTY
    args.push("-progress".to_string());
    args.push(progress_file_str.clone());
    
    args.push("-y".to_string());
    args.push(options.output_path.clone());

    // Log the command for debugging
    eprintln!("[FFmpeg Command]: ffmpeg {}", args.join(" "));

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            let error_msg = format!(
                "Failed to start ffmpeg: {}. Make sure ffmpeg is installed and in your PATH.",
                e
            );
            eprintln!("{}", error_msg);
            error_msg
        })?;

    if let Some(pid) = child.id() {
        state
            .processes
            .lock()
            .unwrap()
            .insert(options.id.clone(), pid);
    }

    // Spawn a task to read the progress file
    let progress_file_clone = progress_file.clone();
    let window_clone = window.clone();
    let options_id = options.id.clone();
    let options_duration = options.duration_seconds;
    let options_total_frames = options.total_frames;
    
    // Create a channel to signal when conversion is done
    let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
    let tx_clone = tx;
    
    let progress_task = task::spawn(async move {
        use tokio::time::{sleep, Duration, Instant};
        use std::collections::VecDeque;
        
        // History to calculate average speed over last 10 seconds
        // Store (timestamp, frame_count) pairs
        let mut frame_history: VecDeque<(Instant, u64)> = VecDeque::new();
        const HISTORY_DURATION_SECS: u64 = 10;
        
        // Track when conversion started
        let start_time = Instant::now();
        
        // Wait a bit for the file to be created
        sleep(Duration::from_millis(500)).await;
        
        loop {
            // Check if we should stop
            if rx.try_recv().is_ok() {
                break;
            }
            
            // Read the entire progress file and parse it
            if let Ok(content) = tokio::fs::read_to_string(&progress_file_clone).await {
                let mut frame = 0u64;
                let mut fps = 0.0;
                let mut bitrate = String::new();
                let mut speed = String::new();
                let mut time_ms = 0.0;
                
                for line in content.lines() {
                    if line.starts_with("frame=") {
                        if let Some(val) = line.strip_prefix("frame=") {
                            frame = val.trim().parse().unwrap_or(0);
                        }
                    } else if line.starts_with("fps=") {
                        if let Some(val) = line.strip_prefix("fps=") {
                            fps = val.trim().parse().unwrap_or(0.0);
                        }
                    } else if line.starts_with("bitrate=") {
                        if let Some(val) = line.strip_prefix("bitrate=") {
                            bitrate = val.trim().to_string();
                        }
                    } else if line.starts_with("speed=") {
                        if let Some(val) = line.strip_prefix("speed=") {
                            speed = val.trim().to_string();
                        }
                    } else if line.starts_with("out_time_ms=") {
                        if let Some(val) = line.strip_prefix("out_time_ms=") {
                            time_ms = val.trim().parse().unwrap_or(0.0);
                        }
                    }
                }
                
                // Only emit if we have valid frame data
                if frame > 0 {
                    let current_seconds = if time_ms > 0.0 {
                        time_ms / 1_000_000.0 // Convert microseconds to seconds
                    } else {
                        0.0
                    };
                    
                    // Calculate progress based on frames if we have total_frames
                    let progress = if let Some(total_frames) = options_total_frames {
                        if total_frames > 0 {
                            ((frame as f64 / total_frames as f64) * 100.0).min(100.0).max(0.0)
                        } else {
                            0.0
                        }
                    } else if options_duration > 0.0 && current_seconds > 0.0 {
                        // Fallback to time-based if frames not available
                        (current_seconds / options_duration * 100.0).min(100.0).max(0.0)
                    } else {
                        0.0
                    };
                    
                    // Update frame history for average speed calculation
                    let now = Instant::now();
                    frame_history.push_back((now, frame));
                    
                    // Remove entries older than HISTORY_DURATION_SECS
                    while let Some(&(timestamp, _)) = frame_history.front() {
                        if now.duration_since(timestamp).as_secs() > HISTORY_DURATION_SECS {
                            frame_history.pop_front();
                        } else {
                            break;
                        }
                    }
                    
                    // Calculate average frames per second over the last 10 seconds
                    let avg_fps = if frame_history.len() >= 2 {
                        let oldest = frame_history.front().unwrap();
                        let newest = frame_history.back().unwrap();
                        let time_diff = newest.0.duration_since(oldest.0).as_secs_f64();
                        let frame_diff = newest.1.saturating_sub(oldest.1) as f64;
                        
                        if time_diff > 0.0 {
                            frame_diff / time_diff
                        } else {
                            fps // Fallback to current fps
                        }
                    } else {
                        fps // Use current fps if not enough history
                    };
                    
                    // Calculate time remaining based on average speed
                    let time_remaining = if let Some(total_frames) = options_total_frames {
                        if total_frames > frame && avg_fps > 0.0 {
                            let remaining_frames = (total_frames - frame) as f64;
                            let remaining_seconds = remaining_frames / avg_fps;
                            Some(remaining_seconds)
                        } else {
                            None
                        }
                    } else if options_duration > 0.0 && current_seconds > 0.0 && avg_fps > 0.0 {
                        // Fallback: estimate based on duration and current progress
                        let remaining_seconds = (options_duration - current_seconds).max(0.0);
                        Some(remaining_seconds)
                    } else {
                        None
                    };
                    
                    // Format time remaining
                    let time_remaining_str = time_remaining.map(|secs| {
                        let hours = (secs as u64) / 3600;
                        let minutes = ((secs as u64) % 3600) / 60;
                        let secs_remaining = (secs as u64) % 60;
                        format!("{:02}:{:02}:{:02}", hours, minutes, secs_remaining)
                    });
                    
                    // Format current time (position in output video)
                    let time_str = if current_seconds > 0.0 {
                        let hours = (current_seconds as u64) / 3600;
                        let minutes = ((current_seconds as u64) % 3600) / 60;
                        let secs = (current_seconds as u64) % 60;
                        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
                    } else {
                        String::new()
                    };
                    
                    // Calculate elapsed time since conversion started
                    let elapsed_seconds = start_time.elapsed().as_secs();
                    let elapsed_hours = elapsed_seconds / 3600;
                    let elapsed_minutes = (elapsed_seconds % 3600) / 60;
                    let elapsed_secs = elapsed_seconds % 60;
                    let elapsed_time_str = format!("{:02}:{:02}:{:02}", elapsed_hours, elapsed_minutes, elapsed_secs);
                    
                    // Only emit if progress is reasonable (not jumping to 100% immediately)
                    if progress < 100.0 || frame >= options_total_frames.unwrap_or(u64::MAX) {
                        let progress_data = ConversionProgress {
                            id: options_id.clone(),
                            frame,
                            fps,
                            time: time_str,
                            elapsed_time: elapsed_time_str,
                            bitrate,
                            speed,
                            progress,
                            time_remaining: time_remaining_str,
                        };
                        
                        let _ = window_clone.emit("conversion_progress", progress_data);
                    }
                }
            }
            
            sleep(Duration::from_millis(200)).await; // Check every 200ms
        }
    });
    
    // Read stderr for errors and warnings
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();
    
    while let Ok(Some(line)) = lines.next_line().await {
        // Log stderr lines (warnings, errors)
        eprintln!("[FFmpeg Stderr]: {}", line);
    }
    
    // Signal progress task to stop
    let _ = tx_clone.send(());
    
    // Wait a bit for the task to finish, then abort if needed
    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
    progress_task.abort();
    
    // Clean up progress file
    let _ = std::fs::remove_file(&progress_file);

    let status = child
        .wait()
        .await
        .map_err(|e| {
            let error_msg = format!("Failed to wait for ffmpeg: {}", e);
            eprintln!("{}", error_msg);
            error_msg
        })?;

    // Remove PID from map
    state.processes.lock().unwrap().remove(&options.id);

    if !status.success() {
        let exit_code = status.code().unwrap_or(-1);
        let error_msg = format!(
            "FFmpeg exited with error code: {}. Check the console output above for details.",
            exit_code
        );
        eprintln!("{}", error_msg);
        return Err(error_msg);
    }

    eprintln!("[FFmpeg] Conversion completed successfully for {}", options.id);
    Ok(())
}

pub fn cancel_conversion(id: &str, state: State<'_, ConversionManager>) -> Result<(), String> {
    let pid = {
        let processes = state.processes.lock().unwrap();
        processes.get(id).cloned()
    };

    if let Some(pid) = pid {
        #[cfg(unix)]
        {
            // Use libc to send SIGTERM for a cleaner exit, then SIGKILL if needed
            // For now, sticking to "kill" command is simple and effective for external processes
            // But let's try to be a bit more graceful
            let _ = std::process::Command::new("kill")
                .arg("-15") // SIGTERM
                .arg(pid.to_string())
                .output();

            // Give it a moment? No, async context here is tricky without async function.
            // Let's just force kill for now to be sure, as FFmpeg might not exit immediately on SIGTERM during heavy load
            let _ = std::process::Command::new("kill")
                .arg("-9") // SIGKILL
                .arg(pid.to_string())
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .arg("/F")
                .arg("/PID")
                .arg(pid.to_string())
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
        Ok(())
    } else {
        Err("Process not found".to_string())
    }
}
