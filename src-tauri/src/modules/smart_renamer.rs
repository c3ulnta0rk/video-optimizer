use crate::modules::metadata_extractor::VideoMetadata;
use crate::modules::tmdb_client::MovieSearchResult;
use regex::Regex;

pub fn generate_filename(
    metadata: &VideoMetadata,
    movie_info: Option<&MovieSearchResult>,
    template: &str,
) -> String {
    let mut filename = template.to_string();

    // Basic replacements
    if let Some(info) = movie_info {
        filename = filename.replace("{title}", &info.title);
        if let Some(date) = &info.release_date {
            let year = date.split('-').next().unwrap_or("");
            filename = filename.replace("{year}", year);
        }
    } else {
        filename = filename.replace("{title}", "Unknown Title");
        filename = filename.replace("{year}", "");
    }

    // Quality
    let quality = if metadata.height >= 2160 {
        "4K"
    } else if metadata.height >= 1080 {
        "1080p"
    } else if metadata.height >= 720 {
        "720p"
    } else {
        "SD"
    };
    filename = filename.replace("{quality}", quality);

    // Codec
    filename = filename.replace("{codec}", &metadata.video_codec);

    // Cleanup double spaces and empty brackets
    filename = filename.replace("  ", " ").trim().to_string();

    // Ensure extension
    if !filename.ends_with(".mp4") {
        filename.push_str(".mp4");
    }

    filename
}

pub fn clean_filename(original: &str) -> String {
    // Remove extension
    let stem = std::path::Path::new(original)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(original);

    // Replace dots and underscores with spaces
    let mut cleaned = stem.replace('.', " ").replace('_', " ");

    // Remove common garbage (case insensitive)
    let garbage = [
        "x264",
        "x265",
        "h264",
        "h265",
        "hevc",
        "1080p",
        "720p",
        "4k",
        "2160p",
        "bluray",
        "web-dl",
        "webrip",
        "hdr",
        "10bit",
        "aac",
        "ac3",
        "dts",
        "multi",
        "vostfr",
        "french",
        "truefrench",
        "ulshd",
        "repack",
        "proper",
    ];

    for g in garbage.iter() {
        // Simple case-insensitive removal
        // Note: This is a bit naive, might remove parts of words.
        // Better approach: split by space, filter out garbage, join.
        let re = Regex::new(&format!(r"(?i)\b{}\b", g)).unwrap();
        cleaned = re.replace_all(&cleaned, "").to_string();
    }

    // Remove year brackets if present (e.g. (2024)) - actually we might want to keep the year but remove brackets?
    // Let's just clean up double spaces for now.

    // Capitalize words
    cleaned = cleaned
        .split_whitespace()
        .map(|word| {
            let mut c = word.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ");

    // Ensure .mp4 extension
    format!("{}.mp4", cleaned)
}

// Parse filename to extract structured information
#[derive(Debug, Default)]
struct ParsedFilename {
    title: Vec<String>,
    year: Option<String>,
    audio_info: Vec<String>, // MULTI, VF2, VF, VO, etc.
    resolution: Option<String>,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    source: Option<String>, // BLURAY, WEB-DL, etc.
}

fn parse_filename_intelligently(original: &str) -> ParsedFilename {
    let stem = std::path::Path::new(original)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(original);

    // Normalize separators
    let normalized = stem.replace('.', " ").replace('_', " ").replace('-', " ");
    let parts: Vec<&str> = normalized.split_whitespace().collect();

    let mut parsed = ParsedFilename::default();
    let mut i = 0;

    // Patterns to recognize
    let year_re = Regex::new(r"^(19|20)\d{2}$").unwrap();
    let resolution_re = Regex::new(r"(?i)^(\d+p|4k|2160p|1080p|720p|480p)$").unwrap();
    let codec_re = Regex::new(r"(?i)^(x264|x265|h264|h265|hevc|av1|vp9)$").unwrap();
    let audio_codec_re = Regex::new(r"(?i)^(dts|ac3|eac3|aac|truehd|flac|opus)$").unwrap();
    let audio_info_re = Regex::new(r"(?i)^(multi|vf|vf2|vo|vostfr|french|truefrench)$").unwrap();
    let source_re = Regex::new(r"(?i)^(bluray|web-dl|webrip|dvdrip|hdtv|bdrip)$").unwrap();

    while i < parts.len() {
        let part = parts[i];
        let part_lower = part.to_lowercase();

        // Check for year (4 digits starting with 19 or 20)
        if year_re.is_match(part) {
            parsed.year = Some(part.to_string());
        }
        // Check for resolution
        else if resolution_re.is_match(part) {
            parsed.resolution = Some(part.to_uppercase().replace("P", "p"));
        }
        // Check for video codec
        else if codec_re.is_match(part) {
            parsed.video_codec = Some(part.to_uppercase());
        }
        // Check for audio codec
        else if audio_codec_re.is_match(part) {
            parsed.audio_codec = Some(part.to_uppercase());
        }
        // Check for audio info (MULTI, VF, VF2, etc.)
        else if audio_info_re.is_match(part) {
            parsed.audio_info.push(part.to_uppercase());
        }
        // Check for source
        else if source_re.is_match(part) {
            parsed.source = Some(part.to_uppercase());
        }
        // Check for VF2, VF, VO patterns (might be separate)
        else if part_lower == "vf" || part_lower == "vo" {
            parsed.audio_info.push(part.to_uppercase());
        }
        // Check for MULTI variations
        else if part_lower.starts_with("multi") {
            parsed.audio_info.push("MULTI".to_string());
        }
        // Everything else is potentially part of the title or other info
        else {
            // Skip common garbage that we don't want
            let garbage = ["chrisj72", "repack", "proper", "hdr", "10bit", "ulshd"];
            let is_garbage = garbage.iter().any(|g| part_lower == *g);
            
            if !is_garbage {
                // If it looks like a username/tag at the end (all lowercase, short), skip it
                if i > parts.len() / 2 && part.len() < 5 && part.chars().all(|c| c.is_lowercase() || c.is_numeric()) {
                    // Skip usernames/tags
                } else {
                    parsed.title.push(part.to_string());
                }
            }
        }
        i += 1;
    }

    parsed
}

pub fn generate_smart_filename(
    original: &str,
    metadata: &VideoMetadata,
    output_video_codec: Option<&str>,
    container: &str,
) -> String {
    // Parse the original filename intelligently
    let parsed = parse_filename_intelligently(original);

    // Build title from parsed parts or use cleaned version
    let title = if !parsed.title.is_empty() {
        parsed.title.join(".")
    } else {
        // Fallback: clean the original name
        let stem = std::path::Path::new(original)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(original);
        let cleaned = stem.replace('.', " ").replace('_', " ").replace('-', " ");
        cleaned
            .split_whitespace()
            .filter(|s| !s.is_empty())
            .map(|word| {
                let mut c = word.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            })
            .collect::<Vec<String>>()
            .join(".")
    };

    // Get year from parsed
    let year = parsed.year.unwrap_or_default();

    // Get resolution (prefer parsed, fallback to metadata)
    let resolution = parsed.resolution.unwrap_or_else(|| {
        if metadata.height >= 2160 {
            "2160p".to_string()
        } else if metadata.height >= 1080 {
            "1080p".to_string()
        } else if metadata.height >= 720 {
            "720p".to_string()
        } else if metadata.height >= 480 {
            "480p".to_string()
        } else {
            "SD".to_string()
        }
    });

    // Get video codec (use output codec if provided, otherwise parsed or input)
    let video_codec_str = if let Some(output_codec) = output_video_codec {
        // Normalize output codec names
        match output_codec.to_lowercase().as_str() {
            "libx264" | "h264" | "h264_nvenc" | "h264_qsv" | "h264_vaapi" | "h264_videotoolbox" | "h264_amf" => "x264".to_string(),
            "libx265" | "hevc" | "hevc_nvenc" | "hevc_qsv" | "hevc_vaapi" | "hevc_videotoolbox" | "hevc_amf" => "x265".to_string(),
            "libsvtav1" | "libaom-av1" => "AV1".to_string(),
            "libvpx-vp9" => "VP9".to_string(),
            _ => {
                if output_codec.to_lowercase().contains("264") {
                    "x264".to_string()
                } else if output_codec.to_lowercase().contains("265") || output_codec.to_lowercase().contains("hevc") {
                    "x265".to_string()
                } else {
                    output_codec.to_string()
                }
            }
        }
    } else if let Some(ref codec) = parsed.video_codec {
        codec.clone()
    } else {
        // Use input codec from metadata
        match metadata.video_codec.to_lowercase().as_str() {
            "h264" | "avc" => "x264".to_string(),
            "h265" | "hevc" => "x265".to_string(),
            "av1" => "AV1".to_string(),
            "vp9" => "VP9".to_string(),
            _ => "x264".to_string(), // Default fallback
        }
    };

    // Get audio info
    let mut audio_parts = Vec::new();
    
    // Add MULTI if multiple audio tracks or if found in filename
    if metadata.audio_streams.len() > 1 || parsed.audio_info.iter().any(|a| a == "MULTI") {
        audio_parts.push("MULTI".to_string());
    }
    
    // Add VF, VF2, VO, etc. from parsed filename
    for audio_info in &parsed.audio_info {
        if audio_info != "MULTI" && !audio_parts.contains(audio_info) {
            audio_parts.push(audio_info.clone());
        }
    }

    // Get audio codec (prefer parsed, fallback to metadata)
    let audio_codec = if let Some(ref codec) = parsed.audio_codec {
        codec.clone()
    } else if !metadata.audio_streams.is_empty() {
        let codec = &metadata.audio_streams[0].codec_name.to_uppercase();
        match codec.as_str() {
            "DTS" | "DTS-HD" | "DTS-HD MA" => "DTS".to_string(),
            "AC3" | "EAC3" => "AC3".to_string(),
            "AAC" => "AAC".to_string(),
            "TRUEHD" => "TRUEHD".to_string(),
            "FLAC" => "FLAC".to_string(),
            "OPUS" => "OPUS".to_string(),
            _ => codec.clone(),
        }
    } else {
        String::new()
    };

    // Build filename parts
    let mut parts = Vec::new();
    
    // Title
    if !title.is_empty() {
        parts.push(title);
    }
    
    // Year
    if !year.is_empty() {
        parts.push(year);
    }
    
    // Audio info (MULTI, VF2, etc.)
    for audio_part in &audio_parts {
        parts.push(audio_part.clone());
    }
    
    // Resolution
    parts.push(resolution);
    
    // Audio codec
    if !audio_codec.is_empty() {
        parts.push(audio_codec);
    }
    
    // Video codec (at the end)
    parts.push(video_codec_str.to_string());

    // Join with dots and add extension
    let filename = format!("{}.{}", parts.join("."), container);

    // Clean up any double dots
    filename.replace("..", ".").trim().to_string()
}