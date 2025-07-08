use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn show_window(app: AppHandle) -> Result<(), ()> {
    let window = app.get_webview_window("main").unwrap();
    window.show().unwrap();
    window.set_focus().unwrap();
    Ok(())
}

#[tauri::command]
pub async fn hide_window(app: AppHandle) -> Result<(), ()> {
    let window = app.get_webview_window("main").unwrap();
    window.hide().unwrap();
    Ok(())
}

#[tauri::command]
pub async fn quit_app(app: AppHandle) -> Result<(), ()> {
    app.exit(0);
    Ok(())
} 
