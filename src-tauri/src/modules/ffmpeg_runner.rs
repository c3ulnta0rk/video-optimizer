use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Clone, Serialize, Debug)]
pub struct ConversionProgress {
    pub id: String,
    pub frame: u64,
    pub fps: f64,
    pub time: String,
    pub bitrate: String,
    pub speed: String,
    pub progress: f64, // 0.0 to 100.0
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionOptions {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub video_codec: String,
    pub audio_track_index: Option<u32>,
    pub subtitle_track_index: Option<u32>,
    pub duration_seconds: f64,
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

fn parse_time_to_seconds(time_str: &str) -> f64 {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() == 3 {
        let hours: f64 = parts[0].parse().unwrap_or(0.0);
        let minutes: f64 = parts[1].parse().unwrap_or(0.0);
        let seconds: f64 = parts[2].parse().unwrap_or(0.0);
        hours * 3600.0 + minutes * 60.0 + seconds
    } else {
        0.0
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

    // Apply Preset (default to "fast" if not specified)
    args.push("-preset".to_string());
    args.push(options.preset.clone().unwrap_or("fast".to_string()));

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
                args.push(audio_bitrate);
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

    args.push("-y".to_string());
    args.push(options.output_path.clone());

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {}", e))?;

    if let Some(pid) = child.id() {
        state
            .processes
            .lock()
            .unwrap()
            .insert(options.id.clone(), pid);
    }

    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    use once_cell::sync::Lazy;

    static RE: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"frame=\s*(\d+)\s+fps=\s*([\d\.]+)\s+.*time=\s*([\d:.]+)\s+.*bitrate=\s*([\w\./]+)\s+.*speed=\s*([\d\.]+)x").unwrap()
    });

    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(caps) = RE.captures(&line) {
            let frame = caps[1].parse::<u64>().unwrap_or(0);
            let fps = caps[2].parse::<f64>().unwrap_or(0.0);
            let time = caps[3].to_string();
            let bitrate = caps[4].to_string();
            let speed = caps[5].to_string();

            let current_seconds = parse_time_to_seconds(&time);
            let progress = if options.duration_seconds > 0.0 {
                (current_seconds / options.duration_seconds * 100.0).min(100.0)
            } else {
                0.0
            };

            let progress_data = ConversionProgress {
                id: options.id.clone(),
                frame,
                fps,
                time,
                bitrate,
                speed,
                progress,
            };

            window
                .emit("conversion_progress", progress_data)
                .map_err(|e| e.to_string())?;
        } else {
            // Log other stderr lines (warnings, errors)
            println!("[FFmpeg Stderr]: {}", line);
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    // Remove PID from map
    state.processes.lock().unwrap().remove(&options.id);

    if !status.success() {
        return Err(format!("FFmpeg exited with status: {}", status));
    }

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
