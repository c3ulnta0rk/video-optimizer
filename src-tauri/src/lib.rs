// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod modules;

use modules::metadata_extractor::VideoMetadata;

#[tauri::command]
fn get_video_metadata(file_path: String) -> Result<VideoMetadata, String> {
    modules::metadata_extractor::extract_metadata(&file_path)
}

#[tauri::command]
async fn convert_video_command(
    window: tauri::Window,
    options: modules::ffmpeg_runner::ConversionOptions,
    state: tauri::State<'_, modules::ffmpeg_runner::ConversionManager>,
) -> Result<(), String> {
    modules::ffmpeg_runner::convert_video(window, options, state).await
}

#[tauri::command]
fn cancel_conversion_command(
    id: String,
    state: tauri::State<'_, modules::ffmpeg_runner::ConversionManager>,
) -> Result<(), String> {
    modules::ffmpeg_runner::cancel_conversion(&id, state)
}

#[tauri::command]
fn clean_filename_command(filename: String) -> String {
    modules::smart_renamer::clean_filename(&filename)
}

#[tauri::command]
async fn search_movie_command(
    query: String,
    api_key: String,
) -> Result<Vec<modules::tmdb_client::MovieSearchResult>, String> {
    modules::tmdb_client::search_movie(&query, &api_key).await
}

#[tauri::command]
fn generate_filename_command(
    metadata: modules::metadata_extractor::VideoMetadata,
    movie_info: Option<modules::tmdb_client::MovieSearchResult>,
    template: String,
) -> String {
    modules::smart_renamer::generate_filename(&metadata, movie_info.as_ref(), &template)
}

#[tauri::command]
fn get_gpu_capabilities_command() -> modules::gpu_detector::GpuCapabilities {
    modules::gpu_detector::check_gpu_availability()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .manage(modules::ffmpeg_runner::ConversionManager::new())
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::TrayIconBuilder;
            use tauri::Manager;

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_video_metadata,
            convert_video_command,
            cancel_conversion_command,
            clean_filename_command,
            get_gpu_capabilities_command,
            generate_filename_command,
            search_movie_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
