mod commands;
mod db;
mod paths;
mod sidecar;
mod updater;
mod wallpaper;
use std::{
    path::PathBuf,
    process::Child,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::Manager;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
};

// Settings 持久化 — 与 Electron 版保持一致的 settings.json 格式
const SETTINGS_FILE_NAME: &str = "settings.json";

pub(crate) fn read_settings(app_data_dir: &std::path::Path) -> serde_json::Value {
    let path = app_data_dir.join(SETTINGS_FILE_NAME);
    if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    } else {
        serde_json::json!({})
    }
}

pub(crate) fn save_settings(app_data_dir: &std::path::Path, settings: &serde_json::Value) {
    let _ = std::fs::create_dir_all(app_data_dir);
    let path = app_data_dir.join(SETTINGS_FILE_NAME);
    if let Ok(text) = serde_json::to_string_pretty(settings) {
        let _ = std::fs::write(&path, text);
    }
}

fn minimize_to_tray_from_settings(settings: &serde_json::Value) -> bool {
    settings
        .get("minimizeToTray")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

#[derive(serde::Serialize, Clone)]
pub struct RuntimeConfig {
    pub sidecar_base_url: String,
    pub app_data_dir: String,
    pub app_version: String,
    pub schema_version: String,
    pub updater_public_key_configured: bool,
}

#[derive(Default)]
pub struct DesktopLyricsRuntimeState {
    pub latest_payload: Option<serde_json::Value>,
    pub click_through: bool,
    pub hot_bounds: Option<commands::DesktopLyricsHotBounds>,
    pub last_middle_at_ms: u64,
    pub poller_running: bool,
    pub poller_starting: bool,
    pub poller_desired: bool,
    pub poller_child: Option<DesktopLyricsPollerChild>,
}

pub struct DesktopLyricsPollerChild {
    child: Option<Child>,
}

impl DesktopLyricsPollerChild {
    pub fn new(child: Child) -> Self {
        Self { child: Some(child) }
    }

    #[cfg(test)]
    pub fn empty_for_test() -> Self {
        Self { child: None }
    }

    pub fn terminate(mut self) -> Result<(), String> {
        let Some(mut child) = self.child.take() else {
            return Ok(());
        };
        let kill_result = child.kill();
        let wait_result = child.wait();
        match (kill_result, wait_result) {
            (_, Ok(_)) => Ok(()),
            (Ok(_), Err(wait_err)) => Err(wait_err.to_string()),
            (Err(kill_err), Err(wait_err)) => Err(format!(
                "kill failed: {}; wait failed: {}",
                kill_err, wait_err
            )),
        }
    }
}

impl Drop for DesktopLyricsPollerChild {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub struct AppState {
    pub config: RuntimeConfig,
    pub desktop_lyrics: Mutex<DesktopLyricsRuntimeState>,
    pub sidecar: Mutex<sidecar::SidecarRuntimeState>,
    pub sidecar_supervisor_running: AtomicBool,
    pub db: Option<Mutex<db::DbRuntimeState>>,
    pub db_init_error: Option<String>,
    pub minimize_to_tray: AtomicBool,
    pub quitting_via_tray: AtomicBool,
}

impl AppState {
    pub fn new(
        sidecar_base_url: String,
        app_data_dir: String,
        app_version: String,
        schema_version: String,
        updater_public_key_configured: bool,
        sidecar_log_path: PathBuf,
        db: Option<Mutex<db::DbRuntimeState>>,
        db_init_error: Option<String>,
        minimize_to_tray: bool,
    ) -> Self {
        Self {
            config: RuntimeConfig {
                sidecar_base_url: sidecar_base_url.clone(),
                app_data_dir,
                app_version,
                schema_version,
                updater_public_key_configured,
            },
            desktop_lyrics: Mutex::new(DesktopLyricsRuntimeState {
                latest_payload: None,
                click_through: true,
                hot_bounds: None,
                last_middle_at_ms: 0,
                poller_running: false,
                poller_starting: false,
                poller_desired: false,
                poller_child: None,
            }),
            sidecar: Mutex::new(sidecar::SidecarRuntimeState::new(
                sidecar_base_url,
                sidecar_log_path,
            )),
            sidecar_supervisor_running: AtomicBool::new(true),
            db,
            db_init_error,
            minimize_to_tray: AtomicBool::new(minimize_to_tray),
            quitting_via_tray: AtomicBool::new(false),
        }
    }
}

fn build_and_start_sidecar(
    state: &AppState,
    port: u16,
    app_data_dir: &std::path::Path,
    log_dir: &std::path::Path,
    app_version: &str,
    resource_dir: Option<&std::path::Path>,
) -> Result<(), sidecar::SidecarError> {
    let cmd = sidecar::build_sidecar_command_with_resource_dir(
        port,
        app_data_dir,
        log_dir,
        app_version,
        resource_dir,
    );
    let mut runtime = state
        .sidecar
        .lock()
        .map_err(|e| sidecar::SidecarError::Io(e.to_string()))?;
    sidecar::spawn_sidecar_into_runtime(&mut runtime, cmd, Duration::from_secs(2))
}

fn start_sidecar_supervisor(
    app: tauri::AppHandle,
    port: u16,
    app_data_dir: PathBuf,
    log_dir: PathBuf,
    app_version: String,
    resource_dir: Option<PathBuf>,
) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(3));
        let state = app.state::<AppState>();
        if !state.sidecar_supervisor_running.load(Ordering::Relaxed) {
            break;
        }
        let should_restart = match state.sidecar.lock() {
            Ok(mut runtime) => {
                sidecar::sidecar_runtime_child_exited(&mut runtime).unwrap_or_default()
            }
            Err(_) => false,
        };
        if !should_restart {
            let should_probe_health = match state.sidecar.lock() {
                Ok(runtime) => sidecar::sidecar_runtime_should_probe_health(&runtime),
                Err(_) => false,
            };
            if should_probe_health {
                if let Ok(health) = sidecar::wait_for_health(
                    &state.config.sidecar_base_url,
                    Duration::from_millis(500),
                ) {
                    if let Ok(mut runtime) = state.sidecar.lock() {
                        if sidecar::sidecar_runtime_should_probe_health(&runtime) {
                            sidecar::sidecar_runtime_mark_ready(
                                &mut runtime,
                                health,
                                sidecar::now_ms(),
                            );
                        }
                    }
                }
            }
            continue;
        }
        if let Ok(mut runtime) = state.sidecar.lock() {
            sidecar::sidecar_runtime_mark_restarting(&mut runtime);
        }
        let _ = build_and_start_sidecar(
            &state,
            port,
            &app_data_dir,
            &log_dir,
            &app_version,
            resource_dir.as_deref(),
        );
    });
}

fn updater_public_key_configured_from_plugin_config(
    plugins: &tauri::utils::config::PluginConfig,
) -> bool {
    plugins
        .0
        .get("updater")
        .and_then(|config| config.get("pubkey"))
        .and_then(|value| value.as_str())
        .map(updater::has_updater_public_key)
        .unwrap_or(false)
}

fn single_instance_window_reactivation_steps() -> [&'static str; 3] {
    ["show", "unminimize", "set_focus"]
}

fn reactivate_main_window_for_single_instance(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window(commands::labels::MAIN) else {
        return;
    };
    for step in single_instance_window_reactivation_steps() {
        match step {
            "show" => {
                let _ = window.show();
            }
            "unminimize" => {
                let _ = window.unminimize();
            }
            "set_focus" => {
                let _ = window.set_focus();
            }
            _ => {}
        }
    }
}

/// 创建系统托盘图标及其右键菜单。
pub fn create_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItemBuilder::with_id("show", "\u{663E}\u{793A}\u{7A97}\u{53E3}").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "\u{9000}\u{51FA}").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&show)
        .separator()
        .item(&quit)
        .build()?;

    let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))?;

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("Mineradio+")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let state = app.state::<AppState>();
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window(commands::labels::MAIN) {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    state.quitting_via_tray.store(true, Ordering::Relaxed);
                    if let Some(window) = app.get_webview_window(commands::labels::MAIN) {
                        let _ = window.close();
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

pub fn run() {
    let app_data_dir = paths::resolve_app_data_dir();
    let log_dir = paths::resolve_log_dir();
    let app_version = env!("CARGO_PKG_VERSION").to_string();
    let schema_version = "0.1.0".to_string();
    let context = tauri::generate_context!();
    let updater_public_key_configured =
        updater_public_key_configured_from_plugin_config(&context.config().plugins);

    let port = sidecar::allocate_port();
    let base_url = format!("http://127.0.0.1:{}", port);
    let sidecar_log_path = sidecar::sidecar_log_path(&log_dir);

    // SQLite 本地存储初始化
    let (db_state, db_init_error) = match db::initialize(&app_data_dir) {
        Ok(s) => (Some(Mutex::new(s)), None),
        Err(e) => {
            let msg = format!(
                "db::initialize failed at {}: {:?}",
                app_data_dir.display(),
                e
            );
            eprintln!("{}", msg);
            (None, Some(msg))
        }
    };

    // 读取 persisted 设置
    let settings = read_settings(&app_data_dir);
    let minimize_to_tray = minimize_to_tray_from_settings(&settings);

    let state = AppState::new(
        base_url.clone(),
        app_data_dir.to_string_lossy().to_string(),
        app_version.clone(),
        schema_version.clone(),
        updater_public_key_configured,
        sidecar_log_path,
        db_state,
        db_init_error,
        minimize_to_tray,
    );

    let setup_app_version = app_version.clone();
    let setup_app_data = app_data_dir.clone();
    let setup_log_dir = log_dir.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            reactivate_main_window_for_single_instance(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_runtime_config,
            commands::get_sidecar_status,
            commands::get_database_status,
            commands::configure_global_hotkeys,
            commands::get_updater_status,
            commands::check_for_update,
            commands::install_update,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_toggle_fullscreen,
            commands::window_close,
            commands::get_window_state,
            commands::open_external,
            commands::export_json_file,
            commands::import_json_file,
            commands::desktop_lyrics_show_window,
            commands::desktop_lyrics_close_window,
            commands::desktop_lyrics_set_click_through,
            commands::desktop_lyrics_move_by,
            commands::desktop_lyrics_set_hot_bounds,
            commands::desktop_lyrics_update_payload,
            commands::desktop_lyrics_overlay_ready,
            commands::login_netease_show_window,
            commands::login_qq_show_window,
            commands::login_netease_complete,
            commands::login_qq_complete,
            commands::login_netease_close_window,
            commands::login_qq_close_window,
            commands::login_kugou_show_window,
            commands::login_kugou_complete,
            commands::login_kugou_close_window,
            commands::get_minimize_to_tray,
            commands::set_minimize_to_tray,
            commands::wallpaper_scan_libraries,
            commands::wallpaper_auto_detect_roots,
            commands::wallpaper_extract_texture,
            commands::wallpaper_read_file,
            commands::wallpaper_clear_cache,
        ])
        .setup(move |app| {
            // NOTE: spawn + health-wait are best-effort. This setup closure only
            // runs under a real `tauri::Builder` app (`tauri dev`), never from
            // cargo tests (tests call only the pure module functions).
            let state = app.state::<AppState>();
            let setup_resource_dir = app.path().resource_dir().ok();
            if let Err(e) = build_and_start_sidecar(
                &state,
                port,
                &setup_app_data,
                &setup_log_dir,
                &setup_app_version,
                setup_resource_dir.as_deref(),
            ) {
                let mut runtime = state.sidecar.lock().map_err(|lock| lock.to_string())?;
                if runtime.child.is_none() {
                    sidecar::sidecar_runtime_mark_start_failed(&mut runtime, &e);
                }
            }
            start_sidecar_supervisor(
                app.handle().clone(),
                port,
                setup_app_data.clone(),
                setup_log_dir.clone(),
                setup_app_version.clone(),
                setup_resource_dir.clone(),
            );

            // 托盘图标 — 仅当 minimize_to_tray 启用时才创建
            if state.minimize_to_tray.load(Ordering::Relaxed) {
                if let Err(e) = create_tray(app.handle()) {
                    eprintln!("tray creation failed: {e}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != commands::labels::MAIN {
                return;
            }
            let emit_mode = match event {
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                    Some(commands::WindowStateEmitMode::Debounced)
                }
                tauri::WindowEvent::Focused(_) | tauri::WindowEvent::ScaleFactorChanged { .. } => {
                    Some(commands::WindowStateEmitMode::Now)
                }
                _ => None,
            };
            if let Some(mode) = emit_mode {
                match mode {
                    commands::WindowStateEmitMode::Now => {
                        commands::emit_window_state_for_window(window)
                    }
                    commands::WindowStateEmitMode::Debounced => {
                        commands::emit_window_state_debounced(window.clone());
                    }
                }
            }
            if !matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                return;
            }

            // 从 event 中取出 api 以决定是否阻止关闭
            let close_api = match &event {
                tauri::WindowEvent::CloseRequested { api, .. } => Some(api),
                _ => None,
            };

            let state = window.state::<AppState>();
            let minimize = state.minimize_to_tray.load(Ordering::Relaxed);
            let quitting = state.quitting_via_tray.load(Ordering::Relaxed);

            if minimize && !quitting {
                // 最小化到托盘：阻止关闭，隐藏窗口
                if let Some(api) = close_api {
                    api.prevent_close();
                }
                let _ = window.hide();
                // 确保托盘存在
                if window.app_handle().tray_by_id("main").is_none() {
                    let _ = create_tray(window.app_handle());
                }
                return;
            }

            // 正常关闭 — 清理 sidecar + 桌面歌词
            state
                .sidecar_supervisor_running
                .store(false, Ordering::Relaxed);
            let sidecar_child = state
                .sidecar
                .lock()
                .ok()
                .and_then(|mut runtime| sidecar::sidecar_runtime_mark_stopped(&mut runtime));
            sidecar::terminate_sidecar_child(sidecar_child);

            let lyrics_child = state.desktop_lyrics.lock().ok().and_then(|mut lyrics| {
                let (_, child) =
                    commands::desktop_lyrics_stop_middle_click_poller_state(&mut lyrics);
                child
            });
            commands::desktop_lyrics_terminate_poller_child(lyrics_child);
        })
        .run(context)
        .expect("failed to run MineRadio-Tauri shell");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_state_new_builds_config() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let db_state = db::DbRuntimeState {
            conn,
            path: std::path::PathBuf::from("/data/mineradio.db"),
        };

        let s = AppState::new(
            "http://127.0.0.1:1".into(),
            "/data".into(),
            "0.1.0".into(),
            "0.1.0".into(),
            false,
            std::path::PathBuf::from("/logs/sidecar-runtime.log"),
            Some(Mutex::new(db_state)),
            None,
            false,
        );
        assert_eq!(s.config.sidecar_base_url, "http://127.0.0.1:1");
        assert_eq!(s.config.app_data_dir, "/data");
        assert_eq!(s.config.app_version, "0.1.0");
        assert_eq!(s.config.schema_version, "0.1.0");
        assert!(!s.config.updater_public_key_configured);
        let lyrics = s.desktop_lyrics.lock().expect("desktop lyrics state");
        assert!(lyrics.latest_payload.is_none());
        assert!(lyrics.click_through);
        assert!(lyrics.hot_bounds.is_none());
        assert_eq!(lyrics.last_middle_at_ms, 0);
        assert!(!lyrics.poller_running);
        assert!(!lyrics.poller_starting);
        assert!(!lyrics.poller_desired);
        assert!(lyrics.poller_child.is_none());
        let sidecar = s.sidecar.lock().expect("sidecar state");
        assert_eq!(sidecar.phase, sidecar::SidecarPhase::Starting);
        assert_eq!(sidecar.base_url, "http://127.0.0.1:1");
        assert!(sidecar.child.is_none());
        assert_eq!(
            sidecar.log_path,
            std::path::PathBuf::from("/logs/sidecar-runtime.log")
        );
    }

    #[test]
    fn updater_public_key_config_is_read_from_tauri_plugin_config() {
        let empty = tauri::utils::config::PluginConfig(Default::default());
        assert!(!updater_public_key_configured_from_plugin_config(&empty));

        let mut plugins = std::collections::HashMap::new();
        plugins.insert(
            "updater".to_string(),
            serde_json::json!({ "endpoints": ["https://example.test/latest.json"], "pubkey": "   " }),
        );
        assert!(!updater_public_key_configured_from_plugin_config(
            &tauri::utils::config::PluginConfig(plugins)
        ));

        let mut plugins = std::collections::HashMap::new();
        plugins.insert(
            "updater".to_string(),
            serde_json::json!({ "endpoints": ["https://example.test/latest.json"], "pubkey": "base64-public-key" }),
        );
        assert!(updater_public_key_configured_from_plugin_config(
            &tauri::utils::config::PluginConfig(plugins)
        ));
    }

    #[test]
    fn single_instance_reactivation_uses_baseline_main_window_steps() {
        assert_eq!(
            single_instance_window_reactivation_steps(),
            ["show", "unminimize", "set_focus"]
        );
    }
}
