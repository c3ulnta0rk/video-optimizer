#[cfg(windows)]
use winapi::um::dwmapi::DwmExtendFrameIntoClientArea;
#[cfg(windows)]
use winapi::shared::windef::HWND;

// Define MARGINS structure (winapi's MARGINS is private, so we define our own)
#[repr(C)]
#[cfg(windows)]
struct DwmMargins {
    cxLeftWidth: i32,
    cxRightWidth: i32,
    cyTopHeight: i32,
    cyBottomHeight: i32,
}

/// Applies the Windows Acrylic blur effect to a window by HWND
/// This uses the DWM (Desktop Window Manager) API to extend the frame into the client area
/// which enables the modern Windows 11 Acrylic blur effect
#[cfg(windows)]
fn apply_blur_by_hwnd(hwnd: HWND) -> Result<(), String> {
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
            return Err(format!("Failed to apply blur effect: HRESULT 0x{:X}", result));
        }
    }
    
    Ok(())
}

/// Tauri command to apply blur effect
/// This will be called from the frontend after the window is created
#[cfg(windows)]
#[tauri::command]
pub fn apply_window_blur(window: tauri::WebviewWindow) -> Result<(), String> {
    use winapi::um::winuser::FindWindowA;
    use std::ffi::CString;
    
    // Get HWND by finding the window by its title
    let hwnd = unsafe {
        let title = window.title().unwrap_or_else(|_| "Video Optimizer".to_string());
        let title_cstr = CString::new(title).unwrap_or_default();
        let hwnd = FindWindowA(std::ptr::null(), title_cstr.as_ptr());
        
        if hwnd.is_null() {
            // Fallback: try to find by class name or use a different method
            return Err("Could not find window handle by title".to_string());
        }
        
        hwnd
    };
    
    // Apply blur using the HWND
    apply_blur_by_hwnd(hwnd)
}

#[cfg(not(windows))]
#[tauri::command]
pub fn apply_window_blur(_window: tauri::WebviewWindow) -> Result<(), String> {
    Err("Blur effect is only supported on Windows".to_string())
}
