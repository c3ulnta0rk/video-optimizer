mod video_commands;
mod window_commands;
mod tray_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            video_commands::get_file_info,
            video_commands::get_video_metadata,
            video_commands::check_ffprobe_available,
            window_commands::minimize_window,
            window_commands::maximize_window,
            window_commands::close_window,
            window_commands::start_dragging,
            window_commands::is_maximized,
            tray_commands::show_window,
            tray_commands::hide_window,
            tray_commands::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
