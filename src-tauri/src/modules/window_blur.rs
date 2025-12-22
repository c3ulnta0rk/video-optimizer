#[cfg(windows)]
use winapi::um::dwmapi::{DwmExtendFrameIntoClientArea, DwmEnableBlurBehindWindow};
#[cfg(windows)]
use winapi::shared::windef::HWND;
#[cfg(windows)]
use winapi::um::dwmapi::DWM_BLURBEHIND;
#[cfg(windows)]
use winapi::um::dwmapi::DWM_BB_ENABLE;

// Define MARGINS structure (winapi's MARGINS is private, so we define our own)
#[repr(C)]
#[cfg(windows)]
#[allow(non_snake_case)]
struct DwmMargins {
    cxLeftWidth: i32,
    cxRightWidth: i32,
    cyTopHeight: i32,
    cyBottomHeight: i32,
}

/// Applies the Windows blur effect using DwmEnableBlurBehindWindow
/// This method works well on Windows 10 and provides a blur effect behind the window
#[cfg(windows)]
fn apply_blur_behind(hwnd: HWND) -> Result<(), String> {
    unsafe {
        let mut blur_behind = DWM_BLURBEHIND {
            dwFlags: DWM_BB_ENABLE,
            fEnable: winapi::shared::minwindef::TRUE,
            hRgnBlur: std::ptr::null_mut(),
            fTransitionOnMaximized: winapi::shared::minwindef::FALSE,
        };
        
        let result = DwmEnableBlurBehindWindow(hwnd, &mut blur_behind);
        
        if result != 0 {
            return Err(format!("DwmEnableBlurBehindWindow failed: HRESULT 0x{:X}", result));
        }
    }
    
    Ok(())
}

/// Applies the Windows Acrylic blur effect using DwmExtendFrameIntoClientArea
/// This method is better for Windows 11 and provides the modern Acrylic blur effect
#[cfg(windows)]
fn apply_acrylic_blur(hwnd: HWND) -> Result<(), String> {
    unsafe {
        // Extend the frame into the client area to enable blur
        // Using -1 for all margins extends the blur to the entire window
        let margins = DwmMargins {
            cxLeftWidth: -1,
            cxRightWidth: -1,
            cyTopHeight: -1,
            cyBottomHeight: -1,
        };
        
        // Cast to the expected pointer type (MARGINS is defined in uxtheme but used by dwmapi)
        let margins_ptr = &margins as *const DwmMargins as *const winapi::um::uxtheme::MARGINS;
        let result = DwmExtendFrameIntoClientArea(hwnd, margins_ptr);
        
        if result != 0 {
            return Err(format!("DwmExtendFrameIntoClientArea failed: HRESULT 0x{:X}", result));
        }
    }
    
    Ok(())
}

/// Applies blur effect to a window by HWND
/// Applies both methods for maximum blur effect
#[cfg(windows)]
fn apply_blur_by_hwnd(hwnd: HWND) -> Result<(), String> {
    // Apply Acrylic blur (Windows 11 style) - this is the primary method
    let acrylic_result = apply_acrylic_blur(hwnd);
    
    // Also apply BlurBehind (Windows 10 style) for additional blur intensity
    // This can work alongside Acrylic for a stronger effect
    let blur_behind_result = apply_blur_behind(hwnd);
    
    // Return success if at least one method worked
    if acrylic_result.is_ok() || blur_behind_result.is_ok() {
        Ok(())
    } else {
        Err(format!(
            "Both blur methods failed. Acrylic: {:?}, BlurBehind: {:?}",
            acrylic_result, blur_behind_result
        ))
    }
}

/// Gets the HWND from a Tauri window
/// Uses FindWindowA with the window title as a reliable method
/// Note: This works because we control the window title and it should be unique
#[cfg(windows)]
fn get_hwnd_from_window(window: &tauri::WebviewWindow) -> Result<HWND, String> {
    use winapi::um::winuser::FindWindowA;
    use std::ffi::CString;
    
    let window_title = window.title().unwrap_or_else(|_| "Video Optimizer".to_string());
    let title_cstr = CString::new(window_title.clone())
        .map_err(|e| format!("Invalid window title: {}", e))?;
    
    let hwnd = unsafe {
        FindWindowA(std::ptr::null(), title_cstr.as_ptr())
    };
    
    if hwnd.is_null() {
        return Err(format!(
            "Could not find window handle for '{}'. Window may not be fully initialized yet. Try calling this function after the window is shown.",
            window_title
        ));
    }
    
    Ok(hwnd)
}

/// Applies blur effect to a Tauri window
/// This function can be called from Rust code (e.g., in setup hook)
#[cfg(windows)]
pub fn apply_blur_to_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    let hwnd = get_hwnd_from_window(window)?;
    apply_blur_by_hwnd(hwnd)
}

/// Tauri command to apply blur effect
/// This can be called from the frontend as a fallback
#[cfg(windows)]
#[tauri::command]
pub fn apply_window_blur(window: tauri::WebviewWindow) -> Result<(), String> {
    apply_blur_to_window(&window)
}

#[cfg(not(windows))]
/// Placeholder function for non-Windows platforms
pub fn apply_blur_to_window(_window: &tauri::WebviewWindow) -> Result<(), String> {
    Err("Blur effect is only supported on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn apply_window_blur(_window: tauri::WebviewWindow) -> Result<(), String> {
    Err("Blur effect is only supported on Windows".to_string())
}
