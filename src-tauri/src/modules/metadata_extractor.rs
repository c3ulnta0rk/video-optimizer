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
                width = stream["width"].as_u64().unwrap_or(0) as u32;
                height = stream["height"].as_u64().unwrap_or(0) as u32;
                video_codec = codec_name;
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
                // Note: SubtitleStream definition above doesn't have channels, so we are good.
                // Wait, I need to check SubtitleStream definition again.
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
    })
}
