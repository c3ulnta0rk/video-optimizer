use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio, Child};
use std::path::Path;
use std::io::{BufRead, BufReader};
use std::sync::Mutex;
use tauri::command;
use tauri::Emitter;

// Variable globale pour stocker le processus FFmpeg en cours
static FFMPEG_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioTrack {
    pub index: u32,
    pub codec: String,
    pub language: Option<String>,
    pub channels: Option<u32>,
    pub sample_rate: Option<u32>,
    pub bitrate: Option<u64>,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubtitleTrack {
    pub index: u32,
    pub codec: String,
    pub language: Option<String>,
    pub title: Option<String>,
    pub is_default: bool,
    pub is_forced: bool,
}

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
    pub audio_tracks: Vec<AudioTrack>,
    pub subtitle_tracks: Vec<SubtitleTrack>,
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
                audio_tracks: Vec::new(),
                subtitle_tracks: Vec::new(),
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

    let mut audio_tracks = Vec::new();
    let mut subtitle_tracks = Vec::new();

    for stream in streams {
        let codec_type = stream.get("codec_type").and_then(|t| t.as_str());
        let codec_name = stream.get("codec_name").and_then(|c| c.as_str());
        let language = stream.get("tags").and_then(|t| t.get("language")).and_then(|l| l.as_str());
        let title = stream.get("tags").and_then(|t| t.get("title")).and_then(|l| l.as_str());
        let is_default = stream.get("disposition").and_then(|d| d.get("default")).and_then(|b| b.as_bool()).unwrap_or(false);
        let is_forced = stream.get("disposition").and_then(|d| d.get("forced")).and_then(|b| b.as_bool()).unwrap_or(false);

        if codec_type == Some("audio") {
            audio_tracks.push(AudioTrack {
                index: stream.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as u32,
                codec: codec_name.unwrap_or("Unknown").to_string(),
                language: language.map(|s| s.to_string()),
                channels: stream.get("channels").and_then(|c| c.as_u64()).and_then(|c| Some(c as u32)),
                sample_rate: stream.get("sample_rate").and_then(|s| s.as_u64()).and_then(|s| Some(s as u32)),
                bitrate: stream.get("bit_rate").and_then(|b| b.as_u64()),
                title: title.map(|s| s.to_string()),
            });
        } else if codec_type == Some("subtitle") {
            subtitle_tracks.push(SubtitleTrack {
                index: stream.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as u32,
                codec: codec_name.unwrap_or("Unknown").to_string(),
                language: language.map(|s| s.to_string()),
                title: title.map(|s| s.to_string()),
                is_default,
                is_forced,
            });
        }
    }

    Ok(VideoMetadata {
        path: String::new(), // Sera rempli par l'appelant
        name: String::new(), // Sera rempli par l'appelant
        size: 0, // Sera rempli par l'appelant
        duration,
        resolution,
        codec,
        bitrate,
        fps,
        audio_tracks,
        subtitle_tracks,
        error: None,
    })
}

// Fonctions helper pour obtenir les vrais indices des streams
fn get_audio_stream_indices(input_path: &str) -> Result<Vec<u32>, String> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-select_streams", "a",
            input_path
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

    let streams = json.get("streams")
        .and_then(|s| s.as_array())
        .ok_or("No streams found")?;

    let mut indices = Vec::new();
    for stream in streams {
        if let Some(index) = stream.get("index").and_then(|i| i.as_u64()) {
            indices.push(index as u32);
        }
    }

    Ok(indices)
}

fn get_subtitle_stream_indices(input_path: &str) -> Result<Vec<u32>, String> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-select_streams", "s",
            input_path
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

    let streams = json.get("streams")
        .and_then(|s| s.as_array())
        .ok_or("No streams found")?;

    let mut indices = Vec::new();
    for stream in streams {
        if let Some(index) = stream.get("index").and_then(|i| i.as_u64()) {
            indices.push(index as u32);
        }
    }

    Ok(indices)
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
    
    // Chercher la section des formats (commence par "Formats:")
    let mut in_formats_section = false;
    
    for line in lines {
        let line = line.trim();
        
        if line.starts_with("Formats:") {
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

#[command]
pub async fn start_video_conversion(
    config: ConversionConfig,
    window: tauri::Window,
) -> Result<ConversionResult, String> {
    let start_time = std::time::Instant::now();
    
    // Analyser d'abord le fichier pour obtenir les vrais indices
    let audio_indices = get_audio_stream_indices(&config.input_path)?;
    let subtitle_indices = get_subtitle_stream_indices(&config.input_path)?;
    
    // Construire la commande FFmpeg
    let mut cmd = Command::new("ffmpeg");
    
    // Options de base
    cmd.args(&["-i", &config.input_path]);
    
    // Ajouter la piste vidéo principale
    cmd.args(&["-map", "0:v:0"]);
    
    // Sélection des pistes audio (utiliser les indices relatifs)
    for &selected_index in &config.selected_audio_tracks {
        if selected_index < audio_indices.len() as u32 {
            cmd.args(&["-map", &format!("0:a:{}", selected_index)]);
        }
    }
    
    // Sélection des pistes de sous-titres (utiliser les indices relatifs)
    for &selected_index in &config.selected_subtitle_tracks {
        if selected_index < subtitle_indices.len() as u32 {
            cmd.args(&["-map", &format!("0:s:{}", selected_index)]);
        }
    }
    
    // Codec vidéo
    let video_codec = match config.codec.as_str() {
        "h264" => "libx264",
        "h265" => "libx265",
        "vp9" => "libvpx-vp9",
        "av1" => "libaom-av1",
        _ => "libx264",
    };
    
    // Codec audio
    let audio_codec = match config.audio_codec.as_str() {
        "aac" => "aac",
        "ac3" => "ac3",
        "mp3" => "mp3",
        "opus" => "libopus",
        _ => "aac",
    };
    
    // Résolution basée sur la qualité
    let resolution = match config.quality.as_str() {
        "4K" => "3840:2160",
        "1080p" => "1920:1080",
        "720p" => "1280:720",
        "480p" => "854:480",
        _ => "1920:1080",
    };
    
    // Arguments de conversion
    cmd.args(&[
        "-c:v", video_codec,
        "-crf", &config.crf.to_string(),
        "-preset", "medium",
        "-c:a", audio_codec,
        "-b:a", "128k",
        "-vf", &format!("scale={}", resolution),
        "-c:s", "copy", // Copier les sous-titres sans conversion (évite les problèmes de conversion)
    ]);

    // Ajouter les métadonnées si disponibles
    if let Some(metadata) = &config.movie_metadata {
        // Métadonnées de base
        cmd.args(&["-metadata", &format!("title={}", metadata.title)]);
        
        if let Some(year) = metadata.year {
            cmd.args(&["-metadata", &format!("date={}", year)]);
        }
        
        if let Some(overview) = &metadata.overview {
            cmd.args(&["-metadata", &format!("comment={}", overview)]);
        }
        
        if let Some(director) = &metadata.director {
            cmd.args(&["-metadata", &format!("director={}", director)]);
        }
        
        if let Some(rating) = metadata.rating {
            cmd.args(&["-metadata", &format!("rating={}", rating)]);
        }
        
        // Ajouter le casting
        if !metadata.cast.is_empty() {
            let cast_string = metadata.cast.join(", ");
            cmd.args(&["-metadata", &format!("artist={}", cast_string)]);
        }
        
        // Ajouter les genres
        if !metadata.genre.is_empty() {
            let genre_string = metadata.genre.join(", ");
            cmd.args(&["-metadata", &format!("genre={}", genre_string)]);
        }
    }

    // Arguments finaux
    cmd.args(&[
        "-progress", "pipe:1",
        "-y", // Écraser le fichier de sortie
        &config.output_path,
    ]);
    
    // Log de la commande pour debug
    println!("Commande FFmpeg: {:?}", cmd);
    
    // Obtenir la durée totale du fichier (en secondes)
    let total_time = {
        let meta = get_ffprobe_metadata(Path::new(&config.input_path))?;
        meta.duration.unwrap_or(0.0)
    };

    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Erreur lors du démarrage de FFmpeg: {}", e))?;

    // Prendre stdout et stderr avant de stocker le processus
    let stdout = child.stdout.take().ok_or("Impossible de capturer la sortie")?;
    let stderr = child.stderr.take().ok_or("Impossible de capturer les erreurs")?;

    // Stocker le processus dans la variable globale
    {
        let mut process_guard = FFMPEG_PROCESS.lock().unwrap();
        *process_guard = Some(child);
    }

    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    let mut current_time = 0.0;
    let mut error_output = String::new();

    // Lire la progression sur stdout
    for line in stdout_reader.lines() {
        let line = line.map_err(|e| format!("Erreur de lecture: {}", e))?;
        if line.starts_with("out_time_ms=") {
            if let Some(time_str) = line.split('=').nth(1) {
                if let Ok(time_ms) = time_str.parse::<u64>() {
                    current_time = time_ms as f64 / 1_000_000.0;
                }
            }
        }
        // Calculer la progression
        if total_time > 0.0 {
            let progress = (current_time / total_time).min(1.0);
            let elapsed = start_time.elapsed().as_secs_f64();
            let eta = if progress > 0.0 { elapsed / progress - elapsed } else { 0.0 };

            let progress_data = ConversionProgress {
                progress,
                current_time,
                total_time,
                speed: 0.0,
                eta,
                status: format!("Conversion en cours... {:.1}%", progress * 100.0),
            };
            
            // Émettre l'événement avec le chemin de la vidéo
            let progress_event = serde_json::json!({
                "video_path": config.input_path,
                "progress": progress_data
            });
            window.emit("conversion_progress", progress_event).ok();
        }
    }

    // Lire les erreurs de stderr (pour le log)
    for line in stderr_reader.lines() {
        if let Ok(line) = line {
            error_output.push_str(&line);
            error_output.push('\n');
        }
    }
    
    // Attendre la fin du processus en le récupérant de la variable globale
    let status = {
        let mut process_guard = FFMPEG_PROCESS.lock().unwrap();
        if let Some(mut child) = process_guard.take() {
            child.wait().map_err(|e| format!("Erreur lors de l'attente: {}", e))?
        } else {
            return Err("Processus FFmpeg non trouvé".to_string());
        }
    };
    
    let duration = start_time.elapsed().as_secs_f64();
    
    if status.success() {
        Ok(ConversionResult {
            success: true,
            output_path: Some(config.output_path),
            error: None,
            duration,
        })
    } else {
        let error_message = if !error_output.is_empty() {
            format!("La conversion a échoué: {}", error_output)
        } else {
            format!("La conversion a échoué (code de sortie: {})", status)
        };
        
        Ok(ConversionResult {
            success: false,
            output_path: None,
            error: Some(error_message),
            duration,
        })
    }
}

#[command]
pub async fn stop_video_conversion() -> Result<bool, String> {
    let mut process_guard = FFMPEG_PROCESS.lock().unwrap();
    
    if let Some(mut child) = process_guard.take() {
        // Tenter d'arrêter le processus
        match child.kill() {
            Ok(_) => {
                println!("Processus FFmpeg arrêté avec succès");
                Ok(true)
            },
            Err(e) => {
                println!("Erreur lors de l'arrêt du processus FFmpeg: {}", e);
                Err(format!("Erreur lors de l'arrêt: {}", e))
            }
        }
    } else {
        println!("Aucun processus FFmpeg en cours");
        Ok(false)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MovieMetadata {
    pub title: String,
    pub year: Option<u32>,
    pub overview: Option<String>,
    pub director: Option<String>,
    pub cast: Vec<String>,
    pub genre: Vec<String>,
    pub rating: Option<f32>,
    pub poster_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionConfig {
    pub input_path: String,
    pub output_path: String,
    pub format: String,
    pub quality: String,
    pub codec: String,
    pub audio_codec: String,
    pub crf: u32,
    pub selected_audio_tracks: Vec<u32>,
    pub selected_subtitle_tracks: Vec<u32>,
    pub movie_metadata: Option<MovieMetadata>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversionProgress {
    pub progress: f64, // 0.0 à 1.0
    pub current_time: f64, // en secondes
    pub total_time: f64, // en secondes
    pub speed: f64, // fps
    pub eta: f64, // en secondes
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub duration: f64, // en secondes
}

#[command]
pub async fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(&["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

#[command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Essayer d'abord avec xdg-open, puis avec des alternatives spécifiques
        let result = Command::new("xdg-open")
            .arg(&path)
            .spawn();
        
        if result.is_err() {
            // Essayer avec nautilus (GNOME)
            let _ = Command::new("nautilus")
                .arg(&path)
                .spawn();
            
            // Essayer avec dolphin (KDE)
            let _ = Command::new("dolphin")
                .arg(&path)
                .spawn();
            
            // Essayer avec thunar (Xfce)
            let _ = Command::new("thunar")
                .arg(&path)
                .spawn();
        }
    }

    Ok(())
} 
