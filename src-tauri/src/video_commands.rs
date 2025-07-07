use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub duration: Option<f64>,
    pub resolution: Option<String>,
    pub codec: Option<String>,
    pub bitrate: Option<u64>,
    pub fps: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub size: u64,
}

#[command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    Ok(FileInfo {
        size: metadata.len(),
    })
}

#[command]
pub async fn get_video_metadata(path: String) -> Result<VideoMetadata, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let file_info = get_file_info(path.to_string_lossy().to_string()).await?;
    
    // Extraire le nom du fichier
    let name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    // Essayer de récupérer les métadonnées avec ffprobe
    let metadata = match get_ffprobe_metadata(path) {
        Ok(mut meta) => {
            meta.path = path.to_string_lossy().to_string();
            meta.name = name;
            meta.size = file_info.size;
            meta
        },
        Err(e) => {
            // Retourner les informations de base si ffprobe échoue
            VideoMetadata {
                path: path.to_string_lossy().to_string(),
                name,
                size: file_info.size,
                duration: None,
                resolution: None,
                codec: None,
                bitrate: None,
                fps: None,
                error: Some(e),
            }
        }
    };

    Ok(metadata)
}

fn get_ffprobe_metadata(path: &Path) -> Result<VideoMetadata, String> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path.to_string_lossy().as_ref()
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    if !output.status.success() {
        return Err("ffprobe command failed".to_string());
    }

    let json_str = String::from_utf8(output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    let json: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Extraire les informations du format
    let format = json.get("format").ok_or("No format information found")?;
    let duration = format.get("duration")
        .and_then(|d| d.as_str())
        .and_then(|d| d.parse::<f64>().ok());

    let bitrate = format.get("bit_rate")
        .and_then(|b| b.as_str())
        .and_then(|b| b.parse::<u64>().ok());

    // Extraire les informations de la vidéo
    let streams = json.get("streams")
        .and_then(|s| s.as_array())
        .ok_or("No streams found")?;

    let video_stream = streams.iter()
        .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video"))
        .ok_or("No video stream found")?;

    let codec = video_stream.get("codec_name")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    let width = video_stream.get("width").and_then(|w| w.as_u64());
    let height = video_stream.get("height").and_then(|h| h.as_u64());
    let resolution = if let (Some(w), Some(h)) = (width, height) {
        Some(format!("{}x{}", w, h))
    } else {
        None
    };

    let fps_str = video_stream.get("r_frame_rate")
        .and_then(|f| f.as_str());
    
    let fps = fps_str.and_then(|fps| {
        let parts: Vec<&str> = fps.split('/').collect();
        if parts.len() == 2 {
            let num = parts[0].parse::<f64>().ok()?;
            let den = parts[1].parse::<f64>().ok()?;
            if den != 0.0 {
                Some(num / den)
            } else {
                None
            }
        } else {
            None
        }
    });

    Ok(VideoMetadata {
        path: String::new(), // Sera rempli par l'appelant
        name: String::new(), // Sera rempli par l'appelant
        size: 0, // Sera rempli par l'appelant
        duration,
        resolution,
        codec,
        bitrate,
        fps,
        error: None,
    })
}

#[command]
pub async fn check_ffprobe_available() -> Result<bool, String> {
    let output = Command::new("ffprobe")
        .arg("-version")
        .output();

    match output {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
} 
