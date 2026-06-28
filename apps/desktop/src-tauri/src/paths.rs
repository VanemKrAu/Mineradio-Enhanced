use std::path::PathBuf;

pub fn with_override(dir: Option<String>, fallback: PathBuf) -> PathBuf {
    match dir {
        Some(s) if !s.trim().is_empty() => PathBuf::from(s),
        _ => fallback,
    }
}

pub fn resolve_app_data_dir() -> PathBuf {
    let override_dir = std::env::var("MINERADIO_APP_DATA_DIR").ok();
    let fallback = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Mineradio");
    with_override(override_dir, fallback)
}

pub fn resolve_log_dir() -> PathBuf {
    let override_dir = std::env::var("MINERADIO_LOG_DIR").ok();
    let fallback = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Mineradio")
        .join("logs");
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
}
