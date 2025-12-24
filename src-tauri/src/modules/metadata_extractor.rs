use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioStream {
    pub index: u32,
    pub codec_name: String,
    pub language: Option<String>,
    pub channels: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubtitleStream {
    pub index: u32,
    pub codec_name: String,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub video_codec: String,
    pub audio_streams: Vec<AudioStream>,
    pub subtitle_streams: Vec<SubtitleStream>,
    pub size: u64, // Added size field
    pub total_frames: Option<u64>, // Total number of frames in the video
}

pub fn extract_metadata(file_path: &str) -> Result<VideoMetadata, String> {
    // Fetch file size
    let size = std::fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);

    let output = Command::new("ffprobe")
        .args(&[
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            file_path,
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&output_str)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    // Basic parsing logic
    let format = json["format"]["format_name"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();
    let duration = json["format"]["duration"]
        .as_str()
        .unwrap_or("0")
        .parse::<f64>()
        .unwrap_or(0.0);

    let mut width = 0;
    let mut height = 0;
    let mut video_codec = "unknown".to_string();
    let mut audio_streams = Vec::new();
    let mut subtitle_streams = Vec::new();

    // First pass: collect all video streams to find the one with highest resolution
    let mut best_video_stream: Option<(u32, u32, String)> = None; // (width, height, codec)

    if let Some(streams) = json["streams"].as_array() {
        for stream in streams {
            let codec_type = stream["codec_type"].as_str().unwrap_or("");
            let index = stream["index"].as_u64().unwrap_or(0) as u32;
            let codec_name = stream["codec_name"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let language = stream["tags"]["language"].as_str().map(|s| s.to_string());

            if codec_type == "video" {
                let stream_width = stream["width"].as_u64().unwrap_or(0) as u32;
                let stream_height = stream["height"].as_u64().unwrap_or(0) as u32;
                
                // Select the video stream with the highest resolution (width * height)
                let current_resolution = stream_width as u64 * stream_height as u64;
                let best_resolution = best_video_stream
                    .as_ref()
                    .map(|(w, h, _)| *w as u64 * *h as u64)
                    .unwrap_or(0);
                
                if current_resolution > best_resolution {
                    best_video_stream = Some((stream_width, stream_height, codec_name.clone()));
                }
            } else if codec_type == "audio" {
                let channels = stream["channels"].as_u64().unwrap_or(2) as u32;
                audio_streams.push(AudioStream {
                    index,
                    codec_name,
                    language,
                    channels,
                });
            } else if codec_type == "subtitle" {
                subtitle_streams.push(SubtitleStream {
                    index,
                    codec_name,
                    language,
                });
            }
        }
    }

    // Use the best video stream found
    if let Some((w, h, codec)) = best_video_stream {
        width = w;
        height = h;
        video_codec = codec;
    }

    // Extract total frames from video stream
    let mut total_frames = None;
    if let Some(streams) = json["streams"].as_array() {
        for stream in streams {
            if stream["codec_type"].as_str() == Some("video") {
                // Try to get nb_frames from stream tags or calculate from duration and fps
                if let Some(nb_frames) = stream["nb_frames"].as_str() {
                    total_frames = nb_frames.parse::<u64>().ok();
                } else if let Some(nb_frames) = stream["nb_frames"].as_u64() {
                    total_frames = Some(nb_frames);
                } else if let Some(fps_str) = stream["r_frame_rate"].as_str() {
                    // Calculate from fps and duration: frames = duration * fps
                    // r_frame_rate is in format "num/den" (e.g., "24/1" or "30000/1001")
                    let parts: Vec<&str> = fps_str.split('/').collect();
                    if parts.len() == 2 {
                        if let (Ok(num), Ok(den)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                            if den > 0.0 {
                                let fps = num / den;
                                total_frames = Some((duration * fps) as u64);
                            }
                        }
                    }
                }
                break; // Only need first video stream
            }
        }
    }

    Ok(VideoMetadata {
        duration,
        width,
        height,
        format,
        video_codec,
        audio_streams,
        subtitle_streams,
        size,
        total_frames,
    })
}
