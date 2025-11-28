use crate::modules::metadata_extractor::VideoMetadata;
use crate::modules::tmdb_client::MovieSearchResult;

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
