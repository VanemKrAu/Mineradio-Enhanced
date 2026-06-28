use serde::Serialize;
use tauri_plugin_updater::Update;

pub const UPDATER_INSTALL_STATE_READY_TO_DOWNLOAD: &str = "ready-to-download";
pub const UPDATER_INSTALL_STATE_SIGNATURE_KEY_MISSING: &str = "signature-key-missing";
pub const UPDATER_INSTALL_STATE_CHECK_FAILED: &str = "check-failed";
pub const UPDATER_INSTALL_STATE_NOT_AVAILABLE: &str = "not-available";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UpdaterStatus {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub body: Option<String>,
    pub message: Option<String>,
    pub date: Option<String>,
    pub error: Option<String>,
    pub requires_signature: bool,
    pub signature_gate: bool,
    pub install_state: String,
}

pub fn has_updater_public_key(pubkey: &str) -> bool {
    !pubkey.trim().is_empty()
}

pub fn signature_gate(has_public_key: bool) -> bool {
    !has_public_key
}

pub fn unavailable_status(current_version: &str, has_public_key: bool) -> UpdaterStatus {
    UpdaterStatus {
        available: false,
        version: None,
        current_version: current_version.to_string(),
        body: None,
        message: None,
        date: None,
        error: None,
        requires_signature: true,
        signature_gate: signature_gate(has_public_key),
        install_state: if signature_gate(has_public_key) {
            UPDATER_INSTALL_STATE_SIGNATURE_KEY_MISSING
        } else {
            UPDATER_INSTALL_STATE_NOT_AVAILABLE
        }
        .to_string(),
    }
}

pub fn checked_update_status(
    current_version: &str,
    version: &str,
    body: Option<String>,
    date: Option<String>,
    has_public_key: bool,
) -> UpdaterStatus {
    let signature_gate = signature_gate(has_public_key);
    UpdaterStatus {
        available: true,
        version: Some(version.to_string()),
        current_version: current_version.to_string(),
        message: body.clone(),
        body,
        date,
        error: None,
        requires_signature: true,
        signature_gate,
        install_state: if signature_gate {
            UPDATER_INSTALL_STATE_SIGNATURE_KEY_MISSING
        } else {
            UPDATER_INSTALL_STATE_READY_TO_DOWNLOAD
        }
        .to_string(),
    }
}

pub fn check_error_status(
    current_version: &str,
    code: &str,
    message: &str,
    has_public_key: bool,
) -> UpdaterStatus {
    UpdaterStatus {
        available: false,
        version: None,
        current_version: current_version.to_string(),
        body: None,
        message: Some(message.to_string()),
        date: None,
        error: Some(code.to_string()),
        requires_signature: true,
        signature_gate: signature_gate(has_public_key),
        install_state: UPDATER_INSTALL_STATE_CHECK_FAILED.to_string(),
    }
}

pub fn update_to_status(update: &Update, has_public_key: bool) -> UpdaterStatus {
    let date = update.date.and_then(|date| {
        date.format(&time::format_description::well_known::Rfc3339)
            .ok()
    });
    checked_update_status(
        &update.current_version,
        &update.version,
        update.body.clone(),
        date,
        has_public_key,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_status_keeps_signature_gate_visible() {
        let s = unavailable_status("0.1.0", false);
        assert!(!s.available);
        assert!(s.version.is_none());
        assert_eq!(s.current_version, "0.1.0");
        assert!(s.message.is_none());
        assert!(s.requires_signature);
        assert!(s.signature_gate);
        assert_eq!(s.install_state, "signature-key-missing");
    }

    #[test]
    fn unavailable_status_with_public_key_is_not_install_ready() {
        let s = unavailable_status("0.1.0", true);

        assert!(!s.available);
        assert!(!s.signature_gate);
        assert_eq!(s.install_state, "not-available");
    }

    #[test]
    fn available_status_maps_release_metadata_without_marking_install_ready() {
        let s = checked_update_status(
            "0.1.0",
            "0.2.0",
            Some("更新说明".to_string()),
            Some("2026-06-28T00:00:00Z".to_string()),
            false,
        );

        assert!(s.available);
        assert_eq!(s.version.as_deref(), Some("0.2.0"));
        assert_eq!(s.current_version, "0.1.0");
        assert_eq!(s.body.as_deref(), Some("更新说明"));
        assert_eq!(s.message.as_deref(), Some("更新说明"));
        assert_eq!(s.date.as_deref(), Some("2026-06-28T00:00:00Z"));
        assert!(s.requires_signature);
        assert!(s.signature_gate);
        assert_eq!(s.install_state, "signature-key-missing");
        assert!(s.error.is_none());
    }

    #[test]
    fn available_status_without_signature_gate_can_download_later() {
        let s = checked_update_status("0.1.0", "0.2.0", None, None, true);

        assert!(s.available);
        assert!(!s.signature_gate);
        assert_eq!(s.install_state, "ready-to-download");
    }

    #[test]
    fn public_key_detection_trims_blank_config() {
        assert!(!has_updater_public_key(""));
        assert!(!has_updater_public_key("   "));
        assert!(has_updater_public_key("base64-public-key"));
    }

    #[test]
    fn check_error_status_carries_error_code_and_message() {
        let s = check_error_status("0.1.0", "UPDATER_CHECK_FAILED", "network down", false);

        assert!(!s.available);
        assert_eq!(s.current_version, "0.1.0");
        assert_eq!(s.error.as_deref(), Some("UPDATER_CHECK_FAILED"));
        assert_eq!(s.message.as_deref(), Some("network down"));
        assert!(s.signature_gate);
        assert_eq!(s.install_state, "check-failed");
    }
}
