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

#[derive(Debug, Serialize, Deserialize)]
pub struct FfmpegFormat {
    pub name: String,
    pub description: String,
    pub extensions: Vec<String>,
}

#[command]
pub async fn get_ffmpeg_output_formats() -> Result<Vec<FfmpegFormat>, String> {
    let output = Command::new("ffmpeg")
        .args(&["-formats"])
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err("ffmpeg command failed".to_string());
    }

    let output_str = String::from_utf8(output.stdout)
        .map_err(|e| format!("Failed to parse ffmpeg output: {}", e))?;

    parse_formats_output(&output_str)
}

fn parse_formats_output(output: &str) -> Result<Vec<FfmpegFormat>, String> {
    let mut formats = Vec::new();
    let lines: Vec<&str> = output.lines().collect();
    
    // Chercher la section des formats de sortie (commence par "File formats:")
    let mut in_formats_section = false;
    
    for line in lines {
        let line = line.trim();
        
        if line.starts_with("File formats:") {
            in_formats_section = true;
            continue;
        }
        
        if !in_formats_section || line.is_empty() {
            continue;
        }
        
        // Les lignes de formats commencent par " E " (espace + E + espace pour les formats de sortie)
        // ou "DE " (pour les formats qui supportent les deux)
        if line.starts_with(" E ") || line.starts_with("DE ") {
            if let Some(format_info) = parse_format_line(line) {
                formats.push(format_info);
            }
        }
    }
    
    println!("Formats trouvés: {}", formats.len());
    Ok(formats)
}

fn parse_format_line(line: &str) -> Option<FfmpegFormat> {
    // Format de ligne: " E  format_name    description" ou "DE  format_name    description"
    let parts: Vec<&str> = line.split_whitespace().collect();
    
    if parts.len() < 3 {
        return None;
    }
    
    let name = parts[1].to_string();
    let description = parts[2..].join(" ");
    
    // Extraire les extensions courantes pour ce format
    let extensions = get_format_extensions(&name);
    
    Some(FfmpegFormat {
        name,
        description,
        extensions,
    })
}

fn get_format_extensions(format_name: &str) -> Vec<String> {
    // Mapping des formats vers leurs extensions courantes
    match format_name.to_lowercase().as_str() {
        "mp4" => vec!["mp4".to_string()],
        "mov" => vec!["mov".to_string()],
        "avi" => vec!["avi".to_string()],
        "mkv" => vec!["mkv".to_string()],
        "webm" => vec!["webm".to_string()],
        "flv" => vec!["flv".to_string()],
        "wmv" => vec!["wmv".to_string()],
        "m4v" => vec!["m4v".to_string()],
        "3gp" => vec!["3gp".to_string()],
        "ogv" => vec!["ogv".to_string()],
        "ts" => vec!["ts".to_string()],
        "mts" => vec!["mts".to_string()],
        "m2ts" => vec!["m2ts".to_string()],
        "vob" => vec!["vob".to_string()],
        "asf" => vec!["asf".to_string()],
        "rm" => vec!["rm".to_string()],
        "rmvb" => vec!["rmvb".to_string()],
        "divx" => vec!["divx".to_string()],
        "xvid" => vec!["avi".to_string()],
        "h264" => vec!["mp4".to_string(), "mkv".to_string()],
        "hevc" => vec!["mp4".to_string(), "mkv".to_string()],
        "vp8" => vec!["webm".to_string()],
        "vp9" => vec!["webm".to_string()],
        "av1" => vec!["mp4".to_string(), "mkv".to_string()],
        _ => vec![format_name.to_string()],
    }
}

#[command]
pub async fn check_ffmpeg_available() -> Result<bool, String> {
    let output = Command::new("ffmpeg")
        .arg("-version")
        .output();

    match output {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
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
