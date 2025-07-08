use tauri::{Window};

#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), ()> {
    window.minimize().map_err(|_| ())
}

#[tauri::command]
pub async fn maximize_window(window: Window) -> Result<(), ()> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|_| ())
    } else {
        window.maximize().map_err(|_| ())
    }
}

#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), ()> {
    window.close().map_err(|_| ())
}

#[tauri::command]
pub async fn start_dragging(window: Window) -> Result<(), ()> {
    window.start_dragging().map_err(|_| ())
}

#[tauri::command]
pub async fn is_maximized(window: Window) -> Result<bool, ()> {
    window.is_maximized().map_err(|_| ())
} 
