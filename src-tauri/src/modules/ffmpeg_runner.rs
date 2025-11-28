use regex::Regex;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{Emitter, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Clone, Serialize, Debug)]
pub struct ConversionProgress {
    pub frame: u64,
    pub fps: f64,
    pub time: String,
    pub bitrate: String,
    pub speed: String,
    pub progress: f64, // 0.0 to 100.0
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionOptions {
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

pub async fn convert_video(window: Window, options: ConversionOptions) -> Result<(), String> {
    let mut args = vec![
        "-i".to_string(),
        options.input_path.clone(),
        "-c:v".to_string(),
        options.video_codec.clone(),
        "-preset".to_string(),
        "fast".to_string(),
    ];

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
            args.push("copy".to_string()); // Or mov_text for mp4
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

    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    let re = Regex::new(r"frame=\s*(\d+)\s+fps=\s*([\d\.]+)\s+.*time=\s*([\d:.]+)\s+.*bitrate=\s*([\w\./]+)\s+.*speed=\s*([\d\.]+)x").unwrap();

    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(caps) = re.captures(&line) {
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
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    if !status.success() {
        return Err(format!("FFmpeg exited with status: {}", status));
    }

    Ok(())
}
