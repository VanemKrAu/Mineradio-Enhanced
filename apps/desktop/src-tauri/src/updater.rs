pub struct UpdaterStatus {
    pub available: bool,
    pub version: Option<String>,
    pub message: Option<String>,
}

pub fn stub_updater_status() -> UpdaterStatus {
    UpdaterStatus {
        available: false,
        version: None,
        message: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stub_status_is_unavailable() {
        let s = stub_updater_status();
        assert!(!s.available);
        assert!(s.version.is_none());
        assert!(s.message.is_none());
    }
}