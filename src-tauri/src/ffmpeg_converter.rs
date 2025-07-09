use ffmpeg_next as ffmpeg;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use tauri::command;
use lazy_static::lazy_static;
use tauri::Emitter;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct FfmpegFormat {
    pub name: String,
    pub description: String,
    pub extensions: Vec<String>,
}

static CONVERSION_STOP_REQUESTED: Mutex<bool> = Mutex::new(false);

pub fn init_ffmpeg() -> Result<(), String> {
    ffmpeg::init().map_err(|e| format!("Failed to initialize FFmpeg: {}", e))
}

#[command]
pub async fn get_video_metadata_ffmpeg(path: String) -> Result<VideoMetadata, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let file_info = get_file_info(path.to_string_lossy().to_string())?;
    
    // Extraire le nom du fichier
    let name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    // Initialiser FFmpeg
    init_ffmpeg()?;

    // Essayer de récupérer les métadonnées avec ffmpeg-next
    let metadata = match get_ffmpeg_metadata(path) {
        Ok(mut meta) => {
            meta.path = path.to_string_lossy().to_string();
            meta.name = name;
            meta.size = file_info.size;
            meta
        },
        Err(e) => {
            // Retourner les informations de base si ffmpeg-next échoue
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

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub size: u64,
}

fn get_file_info(path: String) -> Result<FileInfo, String> {
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

fn get_ffmpeg_metadata(path: &Path) -> Result<VideoMetadata, String> {
    let input_ctx = ffmpeg::format::input(&path)
        .map_err(|e| format!("Failed to open input file: {}", e))?;

    let streams = input_ctx.streams();
    
    // Extraire les informations du format
    let duration = {
        let d = input_ctx.duration();
        if d > 0 {
            Some(d as f64 / f64::from(ffmpeg::ffi::AV_TIME_BASE))
        } else {
            None
        }
    };
    let bitrate = {
        let b = input_ctx.bit_rate();
        if b > 0 {
            Some(b as u64)
        } else {
            None
        }
    };

    let mut video_stream = None;
    let mut audio_tracks = Vec::new();
    let mut subtitle_tracks = Vec::new();

    for (index, stream) in streams.enumerate() {
        let medium = stream.parameters().medium();
        match medium {
            ffmpeg::media::Type::Video => {
                if video_stream.is_none() {
                    video_stream = Some(stream);
                }
            },
            ffmpeg::media::Type::Audio => {
                let codec = stream.parameters().id().name().to_string();
                audio_tracks.push(AudioTrack {
                    index: index as u32,
                    codec,
                    language: None,
                    channels: None,
                    sample_rate: None,
                    bitrate: None,
                    title: None,
                });
            },
            ffmpeg::media::Type::Subtitle => {
                let codec = stream.parameters().id().name().to_string();
                subtitle_tracks.push(SubtitleTrack {
                    index: index as u32,
                    codec,
                    language: None,
                    title: None,
                    is_default: false,
                    is_forced: false,
                });
            },
            _ => {}
        }
    }

    // Extraire les informations de la vidéo
    let (codec, resolution, fps) = if let Some(stream) = video_stream {
        let codec = stream.parameters().id().name().to_string();
        let resolution = None;
        let fps = None;
        (Some(codec), resolution, fps)
    } else {
        (None, None, None)
    };

    Ok(VideoMetadata {
        path: path.to_string_lossy().to_string(),
        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        size: 0,
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

#[command]
pub async fn start_video_conversion_ffmpeg(
    config: ConversionConfig,
    window: tauri::Window,
) -> Result<ConversionResult, String> {
    start_video_conversion_ffmpeg_internal(config, Some(window)).await
}

async fn start_video_conversion_ffmpeg_internal(
    config: ConversionConfig,
    window: Option<tauri::Window>,
) -> Result<ConversionResult, String> {
    let start_time = std::time::Instant::now();
    
    // Initialiser FFmpeg
    init_ffmpeg()?;

    let input_path = Path::new(&config.input_path);
    let output_path = Path::new(&config.output_path);

    // Créer le répertoire de sortie si nécessaire
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Mapper les codecs vers les noms corrects de ffmpeg
    let video_codec = match config.codec.as_str() {
        "h264" => "libx264",
        "h265" => "libx265",
        "vp9" => "libvpx-vp9",
        "av1" => "libaom-av1",
        _ => "libx264",
    };
    
    let audio_codec = match config.audio_codec.as_str() {
        "aac" => "aac",
        "ac3" => "ac3",
        "mp3" => "mp3",
        "opus" => "libopus",
        "flac" => "flac",
        _ => "aac",
    };

    // Construire la commande ffmpeg avec les bons codecs
    let mut command = std::process::Command::new("ffmpeg");
    command.args(&[
        "-i", &config.input_path,
        "-c:v", video_codec,
        "-c:a", audio_codec,
        "-crf", &config.crf.to_string(),
        "-preset", "medium",
        "-progress", "pipe:1", // Envoyer la progression sur stdout
        "-y", // Overwrite output file
        &config.output_path
    ]);

    // Démarrer le processus
    let mut child = command
        .stderr(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    let stderr = child.stderr.take().unwrap();
    let _stdout = child.stdout.take().unwrap();

    // Variables pour le suivi de progression
    let mut total_duration = 0.0;
    let mut current_time = 0.0;
    let mut fps = 0.0;
    let mut speed = 0.0;
    let mut last_progress_update = std::time::Instant::now();

    // Lire la sortie stderr pour extraire les informations de progression
    use std::io::{BufRead, BufReader};
    let stderr_reader = BufReader::new(stderr);
    
    for line in stderr_reader.lines() {
        let line = line.map_err(|e| format!("Failed to read stderr: {}", e))?;
        
        // Parser les lignes de progression
        if line.starts_with("Duration:") {
            // Extraire la durée totale
            if let Some(duration_str) = line.split("Duration:").nth(1) {
                if let Some(time_str) = duration_str.split_whitespace().next() {
                    total_duration = parse_time(time_str);
                }
            }
        } else if line.contains("time=") {
            // Extraire le temps actuel
            if let Some(time_part) = line.split("time=").nth(1) {
                if let Some(time_str) = time_part.split_whitespace().next() {
                    current_time = parse_time(time_str);
                }
            }
            
            // Extraire la vitesse
            if let Some(speed_part) = line.split("speed=").nth(1) {
                if let Some(speed_str) = speed_part.split_whitespace().next() {
                    if let Ok(s) = speed_str.parse::<f64>() {
                        speed = s;
                    }
                }
            }
            
            // Extraire le FPS
            if let Some(fps_part) = line.split("fps=").nth(1) {
                if let Some(fps_str) = fps_part.split_whitespace().next() {
                    if let Ok(f) = fps_str.parse::<f64>() {
                        fps = f;
                    }
                }
            }

            // Calculer la progression
            let progress = if total_duration > 0.0 {
                (current_time / total_duration).min(1.0)
            } else {
                0.0
            };

            // Calculer l'ETA
            let elapsed = start_time.elapsed().as_secs_f64();
            let eta = if progress > 0.01 && speed > 0.0 {
                (total_duration - current_time) / speed
            } else {
                0.0
            };

            // Mettre à jour la progression toutes les 100ms
            let now = std::time::Instant::now();
            if now.duration_since(last_progress_update).as_millis() > 100 {
                let progress_data = ConversionProgress {
                    progress,
                    current_time,
                    total_time: total_duration,
                    speed: fps,
                    eta,
                    status: format!("Converting... {:.1}% (ETA: {:.0}s)", progress * 100.0, eta),
                };

                // Émettre la progression seulement si une fenêtre est présente
                if let Some(ref window) = window {
                    let _ = window.emit("conversion_progress", progress_data);
                } else {
                    // Afficher dans la console pour les tests
                    println!("Progress: {:.1}% - ETA: {:.0}s - {}", progress * 100.0, eta, progress_data.status);
                }
                last_progress_update = now;
            }
        }

        // Vérifier si l'arrêt a été demandé
        {
            let stop_requested = CONVERSION_STOP_REQUESTED.lock().unwrap();
            if *stop_requested {
                let _ = child.kill();
                return Ok(ConversionResult {
                    success: false,
                    output_path: None,
                    error: Some("Conversion stopped by user".to_string()),
                    duration: start_time.elapsed().as_secs_f64(),
                });
            }
        }
    }

    // Attendre la fin du processus
    let output = child.wait()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    let duration = start_time.elapsed().as_secs_f64();

    // Progression finale
    let final_progress = ConversionProgress {
        progress: 1.0,
        current_time: total_duration,
        total_time: total_duration,
        speed: fps,
        eta: 0.0,
        status: "Conversion terminée!".to_string(),
    };
    
    // Émettre la progression finale seulement si une fenêtre est présente
    if let Some(ref window) = window {
        let _ = window.emit("conversion_progress", final_progress);
    } else {
        println!("Conversion terminée! Durée: {:.1}s", duration);
    }

    if output.success() {
        Ok(ConversionResult {
            success: true,
            output_path: Some(config.output_path),
            error: None,
            duration,
        })
    } else {
        Ok(ConversionResult {
            success: false,
            output_path: None,
            error: Some("FFmpeg conversion failed".to_string()),
            duration,
        })
    }
}

/*
#[command]
pub async fn start_video_conversion_native(
    config: ConversionConfig,
    window: tauri::Window,
) -> Result<ConversionResult, String> {
    let start_time = std::time::Instant::now();
    
    // Initialiser FFmpeg
    init_ffmpeg()?;

    let input_path = Path::new(&config.input_path);
    let output_path = Path::new(&config.output_path);

    // Créer le répertoire de sortie si nécessaire
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Ouvrir le fichier d'entrée
    let input_ctx = ffmpeg::format::input(&input_path)
        .map_err(|e| format!("Failed to open input file: {}", e))?;

    // Trouver le stream vidéo
    let video_stream = input_ctx.streams()
        .best(ffmpeg::media::Type::Video)
        .ok_or("No video stream found")?;

    let video_stream_index = video_stream.index();
    
    // Créer le contexte de sortie
    let mut output_ctx = ffmpeg::format::output(&output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;

    // Ajouter le stream vidéo à la sortie (copie directe pour l'instant)
    let mut out_stream = output_ctx.add_stream(ffmpeg::encoder::find(video_stream.parameters().id()))
        .map_err(|e| format!("Failed to add output stream: {}", e))?;

    out_stream.set_parameters(video_stream.parameters());

    // Écrire l'en-tête du fichier de sortie
    output_ctx.write_header()
        .map_err(|e| format!("Failed to write output header: {}", e))?;

    // Variables pour la progression
    let total_frames = estimate_total_frames(&input_ctx, video_stream)?;
    let mut processed_frames = 0;
    let mut last_progress_update = std::time::Instant::now();

    // Traitement des paquets avec l'API correcte
    for (stream, mut packet) in input_ctx.packets() {
        // Vérifier si l'arrêt a été demandé
        {
            let stop_requested = CONVERSION_STOP_REQUESTED.lock().unwrap();
            if *stop_requested {
                return Ok(ConversionResult {
                    success: false,
                    output_path: None,
                    error: Some("Conversion stopped by user".to_string()),
                    duration: start_time.elapsed().as_secs_f64(),
                });
            }
        }

        if stream.index() == video_stream_index {
            // Copier le paquet vers la sortie (pour l'instant, pas de réencodage)
            packet.set_stream(0);
            if let Err(e) = output_ctx.write_packet(&packet) {
                eprintln!("Warning: Failed to write packet: {}", e);
            }
            
            processed_frames += 1;
        }

        // Mettre à jour la progression
        let now = std::time::Instant::now();
        if now.duration_since(last_progress_update).as_millis() > 100 {
            let progress = if total_frames > 0 {
                (processed_frames as f64 / total_frames as f64).min(1.0)
            } else {
                0.0
            };

            let elapsed = start_time.elapsed().as_secs_f64();
            let eta = if progress > 0.01 {
                (elapsed / progress) - elapsed
            } else {
                0.0
            };

            let progress_data = ConversionProgress {
                progress,
                current_time: 0.0, // TODO: calculer le temps actuel
                total_time: 0.0,   // TODO: calculer la durée totale
                speed: if elapsed > 0.0 { processed_frames as f64 / elapsed } else { 0.0 },
                eta,
                status: format!("Converting frame {}/{} ({:.1}%)", processed_frames, total_frames, progress * 100.0),
            };

            let _ = window.emit("conversion_progress", progress_data);
            last_progress_update = now;
        }
    }

    // Écrire le trailer
    output_ctx.write_trailer()
        .map_err(|e| format!("Failed to write output trailer: {}", e))?;

    let duration = start_time.elapsed().as_secs_f64();

    // Progression finale
    let final_progress = ConversionProgress {
        progress: 1.0,
        current_time: 0.0,
        total_time: 0.0,
        speed: processed_frames as f64 / duration,
        eta: 0.0,
        status: "Conversion terminée!".to_string(),
    };
    let _ = window.emit("conversion_progress", final_progress);

    Ok(ConversionResult {
        success: true,
        output_path: Some(output_path.to_string_lossy().to_string()),
        error: None,
        duration,
    })
}
*/

#[command]
pub async fn test_conversion_with_file() -> Result<String, String> {
    let config = ConversionConfig {
        input_path: "extrait.mkv".to_string(),
        output_path: "test_output.mkv".to_string(),
        format: "mkv".to_string(),
        quality: "medium".to_string(),
        codec: "h264".to_string(),
        audio_codec: "aac".to_string(),
        crf: 23,
        selected_audio_tracks: vec![],
        selected_subtitle_tracks: vec![],
    };

    // Utiliser la version shell qui fonctionne
    let result = start_video_conversion_ffmpeg_internal(config, None).await?;
    
    if result.success {
        Ok(format!("Test réussi ! Fichier créé: {:?}", result.output_path))
    } else {
        Err(format!("Test échoué: {:?}", result.error))
    }
}

fn parse_time(time_str: &str) -> f64 {
    // Parse time format like "00:01:23.45" or "01:23.45"
    let parts: Vec<&str> = time_str.split(':').collect();
    match parts.len() {
        3 => {
            // Format: HH:MM:SS.mmm
            let hours: f64 = parts[0].parse().unwrap_or(0.0);
            let minutes: f64 = parts[1].parse().unwrap_or(0.0);
            let seconds: f64 = parts[2].parse().unwrap_or(0.0);
            hours * 3600.0 + minutes * 60.0 + seconds
        },
        2 => {
            // Format: MM:SS.mmm
            let minutes: f64 = parts[0].parse().unwrap_or(0.0);
            let seconds: f64 = parts[1].parse().unwrap_or(0.0);
            minutes * 60.0 + seconds
        },
        _ => 0.0
    }
}

#[command]
pub async fn stop_video_conversion_ffmpeg() -> Result<bool, String> {
    let mut stop_requested = CONVERSION_STOP_REQUESTED.lock().unwrap();
    *stop_requested = true;
    Ok(true)
}

#[command]
pub async fn check_ffmpeg_available_ffmpeg() -> Result<bool, String> {
    match init_ffmpeg() {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[command]
pub async fn get_ffmpeg_output_formats_ffmpeg() -> Result<Vec<FfmpegFormat>, String> {
    // ffmpeg-next ne fournit pas directement la liste des formats
    // On retourne une liste basique des formats courants
    let formats = vec![
        FfmpegFormat {
            name: "mp4".to_string(),
            description: "MP4 (MPEG-4 Part 14)".to_string(),
            extensions: vec!["mp4".to_string()],
        },
        FfmpegFormat {
            name: "mkv".to_string(),
            description: "Matroska".to_string(),
            extensions: vec!["mkv".to_string()],
        },
        FfmpegFormat {
            name: "avi".to_string(),
            description: "AVI (Audio Video Interleave)".to_string(),
            extensions: vec!["avi".to_string()],
        },
        FfmpegFormat {
            name: "mov".to_string(),
            description: "QuickTime Movie".to_string(),
            extensions: vec!["mov".to_string()],
        },
        FfmpegFormat {
            name: "webm".to_string(),
            description: "WebM".to_string(),
            extensions: vec!["webm".to_string()],
        },
    ];

    Ok(formats)
} 

fn estimate_total_frames(input_ctx: &ffmpeg::format::context::Input, video_stream: ffmpeg::Stream) -> Result<u64, String> {
    let duration = input_ctx.duration();
    if duration > 0 {
        let duration_sec = duration as f64 / f64::from(ffmpeg::ffi::AV_TIME_BASE);
        // Estimer 25 fps par défaut
        let fps = 25.0;
        Ok((duration_sec * fps) as u64)
    } else {
        Ok(0)
    }
} 
