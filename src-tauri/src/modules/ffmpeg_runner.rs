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
    pub video_codec: String,               // e.g., "libx264"
    pub audio_track_index: Option<u32>,    // None = default (first track)
    pub subtitle_track_index: Option<u32>, // None = no subtitles
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

    // Audio mapping
    if let Some(index) = options.audio_track_index {
        args.push("-map".to_string());
        args.push(format!("0:{}", index)); // Map by absolute index (simplified)
                                           // Ideally we should map by stream type index, but for now let's assume the index comes from our metadata which is absolute
                                           // Wait, ffprobe index is absolute. -map 0:<index> works.
    } else {
        // Default: map first audio stream if exists, or let ffmpeg decide
        args.push("-c:a".to_string());
        args.push("aac".to_string());
    }

    // Subtitle mapping
    if let Some(index) = options.subtitle_track_index {
        args.push("-map".to_string());
        args.push(format!("0:{}", index));
        args.push("-c:s".to_string());
        args.push("mov_text".to_string()); // MP4 compatible
    }

    args.push("-y".to_string());
    args.push(options.output_path.clone());

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped()) // FFmpeg writes stats to stderr
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {}", e))?;

    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    // Regex to parse FFmpeg progress line
    // frame=  123 fps= 25 q=28.0 size=    1024kB time=00:00:05.00 bitrate=1234.5kbits/s speed=1.0x
    let re = Regex::new(r"frame=\s*(\d+)\s+fps=\s*([\d\.]+)\s+.*time=\s*([\d:.]+)\s+.*bitrate=\s*([\w\./]+)\s+.*speed=\s*([\d\.]+)x").unwrap();

    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(caps) = re.captures(&line) {
            let frame = caps[1].parse::<u64>().unwrap_or(0);
            let fps = caps[2].parse::<f64>().unwrap_or(0.0);
            let time = caps[3].to_string();
            let bitrate = caps[4].to_string();
            let speed = caps[5].to_string();

            // Calculate progress percentage if we knew total duration (TODO)
            // For now, just emit the raw stats
            let progress_data = ConversionProgress {
                frame,
                fps,
                time,
                bitrate,
                speed,
                progress: 0.0, // Placeholder
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
