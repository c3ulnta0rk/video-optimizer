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
