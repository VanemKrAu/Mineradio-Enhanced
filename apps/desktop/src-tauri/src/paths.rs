use std::path::PathBuf;

pub const TAURI_REWRITE_APP_DATA_DIR_NAME: &str = "Mineradio Tauri Rewrite";

pub fn with_override(dir: Option<String>, fallback: PathBuf) -> PathBuf {
    match dir {
        Some(s) if !s.trim().is_empty() => PathBuf::from(s),
        _ => fallback,
    }
}

pub fn default_app_data_dir_from_base(base: PathBuf) -> PathBuf {
    base.join(TAURI_REWRITE_APP_DATA_DIR_NAME)
}

pub fn default_log_dir_from_base(base: PathBuf) -> PathBuf {
    default_app_data_dir_from_base(base).join("logs")
}

pub fn resolve_app_data_dir() -> PathBuf {
    let override_dir = std::env::var("MINERADIO_APP_DATA_DIR").ok();
    let fallback = dirs::data_dir()
        .map(default_app_data_dir_from_base)
        .unwrap_or_else(|| default_app_data_dir_from_base(PathBuf::from(".")));
    with_override(override_dir, fallback)
}

pub fn resolve_log_dir() -> PathBuf {
    let override_dir = std::env::var("MINERADIO_LOG_DIR").ok();
    let fallback = dirs::data_dir()
        .map(default_log_dir_from_base)
        .unwrap_or_else(|| default_log_dir_from_base(PathBuf::from(".")));
    with_override(override_dir, fallback)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn with_override_uses_override_when_set() {
        let p = with_override(Some("/tmp/data".to_string()), PathBuf::from("/fallback"));
        assert_eq!(p, PathBuf::from("/tmp/data"));
    }

    #[test]
    fn with_override_falls_back_when_unset() {
        let p = with_override(None, PathBuf::from("/fallback"));
        assert_eq!(p, PathBuf::from("/fallback"));
    }

    #[test]
    fn with_override_falls_back_when_empty() {
        let p = with_override(Some("".to_string()), PathBuf::from("/fallback"));
        assert_eq!(p, PathBuf::from("/fallback"));
    }

    #[test]
    fn with_override_falls_back_when_whitespace() {
        let p = with_override(Some("   ".to_string()), PathBuf::from("/fallback"));
        assert_eq!(p, PathBuf::from("/fallback"));
    }

    #[test]
    fn resolve_dirs_returns_nonempty_paths() {
        let app_data = resolve_app_data_dir();
        let logs = resolve_log_dir();
        assert!(app_data.to_string_lossy().len() > 0);
        assert!(logs.to_string_lossy().len() > 0);
    }

    #[test]
    fn default_dirs_use_tauri_rewrite_identity_not_legacy_mineradio_dir() {
        let base = PathBuf::from("/user-data");
        let app_data = default_app_data_dir_from_base(base.clone());
        let logs = default_log_dir_from_base(base);
        assert_eq!(app_data, PathBuf::from("/user-data").join("Mineradio Tauri Rewrite"));
        assert_eq!(
            logs,
            PathBuf::from("/user-data")
                .join("Mineradio Tauri Rewrite")
                .join("logs")
        );
    }
}
