//! Tauri command handlers for the Mineradio runtime shell.
//!
//! `export_json_file` and `import_json_file` are intentionally stubbed for this
//! phase; real dialog/filesystem wiring arrives in a later release-bundling
//! phase (see docs/migration/plans/05-tauri-runtime.md).

use crate::AppState;
use tauri::Manager;

pub mod labels {
    pub const MAIN: &str = "main";
    pub const DESKTOP_LYRICS: &str = "desktop-lyrics";
    pub const WALLPAPER: &str = "wallpaper";
    pub const LOGIN_NETEASE: &str = "login-netease";
    pub const LOGIN_QQ: &str = "login-qq";
}

#[tauri::command]
pub fn get_runtime_config(state: tauri::State<'_, AppState>) -> crate::RuntimeConfig {
    state.config.clone()
}

fn main_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(labels::MAIN)
        .ok_or_else(|| "main window not found".to_string())
}

#[tauri::command]
pub fn window_minimize(app: tauri::AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    win.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_toggle_maximize(app: tauri::AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    if win.is_maximized().unwrap_or(false) {
        win.unmaximize().map_err(|e| e.to_string())?;
    } else {
        win.maximize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn window_toggle_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    let fs = win.is_fullscreen().unwrap_or(false);
    win.set_fullscreen(!fs).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_close(app: tauri::AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    win.close().map_err(|e| e.to_string())
}

pub fn is_openable_url(url: &str) -> bool {
    url.starts_with("http://") || url.starts_with("https://")
}

#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if !is_openable_url(&url) {
        return Err("INVALID_URL".into());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn export_json_file() -> Result<(), String> {
    Err("EXPORT_IMPORT_NOT_IMPLEMENTED".into())
}

#[tauri::command]
pub fn import_json_file() -> Result<(), String> {
    Err("EXPORT_IMPORT_NOT_IMPLEMENTED".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openable_url_accepts_http_and_https() {
        assert!(is_openable_url("http://example.com"));
        assert!(is_openable_url("https://example.com/path"));
    }

    #[test]
    fn openable_url_rejects_non_http_schemes() {
        assert!(!is_openable_url("file:///etc/passwd"));
        assert!(!is_openable_url("javascript:alert(1)"));
        assert!(!is_openable_url("ftp://example.com"));
        assert!(!is_openable_url(""));
        assert!(!is_openable_url("data:text/plain,hi"));
    }
}