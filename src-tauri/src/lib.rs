// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod modules;
use std::sync::Mutex;
use tauri::{menu::MenuItem, Wry};

pub struct TrayState {
    pub status_item: Mutex<Option<MenuItem<Wry>>>,
    pub stop_item: Mutex<Option<MenuItem<Wry>>>,
}

use modules::metadata_extractor::VideoMetadata;

#[tauri::command]
fn log_frontend(message: String) {
    eprintln!("[Frontend] {}", message);
}

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
async fn cancel_conversion_command(
    id: String,
    state: tauri::State<'_, modules::ffmpeg_runner::ConversionManager>,
) -> Result<(), String> {
    modules::ffmpeg_runner::cancel_conversion(&id, state).await
}

#[tauri::command]
fn clean_filename_command(filename: String) -> String {
    modules::smart_renamer::clean_filename(&filename)
}

#[tauri::command]
fn generate_smart_filename_command(
    filename: String,
    metadata: VideoMetadata,
    output_video_codec: Option<String>,
    container: String,
) -> String {
    modules::smart_renamer::generate_smart_filename(
        &filename,
        &metadata,
        output_video_codec.as_deref(),
        &container,
    )
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

#[tauri::command]
async fn quit_app_command(
    app: tauri::AppHandle,
    state: tauri::State<'_, modules::ffmpeg_runner::ConversionManager>,
) -> Result<(), String> {
    modules::ffmpeg_runner::kill_all(state).await;
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .manage(modules::ffmpeg_runner::ConversionManager::new())
        .manage(TrayState {
            status_item: Mutex::new(None),
            stop_item: Mutex::new(None),
        })
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::TrayIconBuilder;
            use tauri::Manager;

            let status_i =
                MenuItem::with_id(app, "status", "No active conversions", false, None::<&str>)?;
            let stop_i = MenuItem::with_id(app, "stop", "Stop Conversion", false, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&status_i, &stop_i, &show_i, &quit_i])?;

            if let Some(state) = app.try_state::<TrayState>() {
                *state.status_item.lock().unwrap() = Some(status_i.clone());
                *state.stop_item.lock().unwrap() = Some(stop_i.clone());
            }

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "stop" => {
                        let app_handle = app.app_handle().clone();
                        tauri::async_runtime::spawn(async move {
                            use tauri::Manager;
                            let state =
                                app_handle.state::<modules::ffmpeg_runner::ConversionManager>();
                            let _ = modules::ffmpeg_runner::cancel_current(state).await;
                        });
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
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
            generate_smart_filename_command,
            get_gpu_capabilities_command,
            generate_filename_command,
            search_movie_command,
            quit_app_command,
            log_frontend
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn update_tray_status(app: &tauri::AppHandle, text: &str) {
    use tauri::Manager;
    if let Some(state) = app.try_state::<TrayState>() {
        if let Some(item) = state.status_item.lock().unwrap().as_ref() {
            let _ = item.set_text(text);
        }
    }
}

pub fn set_stop_enabled(app: &tauri::AppHandle, enabled: bool) {
    use tauri::Manager;
    if let Some(state) = app.try_state::<TrayState>() {
        if let Some(item) = state.stop_item.lock().unwrap().as_ref() {
            let _ = item.set_enabled(enabled);
        }
    }
}
