use std::path::Path;

#[derive(Debug, PartialEq, Eq)]
pub struct HealthInfo {
    pub ok: bool,
    pub app_version: String,
    pub api_version: String,
    pub schema_version: String,
}

#[derive(Debug)]
pub enum SidecarError {
    Timeout,
    BadUrl,
    Io(String),
    BadStatus,
    Parse(String),
}

impl std::fmt::Display for SidecarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SidecarError::Timeout => write!(f, "sidecar health check timed out"),
            SidecarError::BadUrl => write!(f, "bad base url"),
            SidecarError::Io(msg) => write!(f, "io error: {}", msg),
            SidecarError::BadStatus => write!(f, "bad http status"),
            SidecarError::Parse(msg) => write!(f, "parse error: {}", msg),
        }
    }
}

impl std::error::Error for SidecarError {}

pub fn allocate_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .expect("failed to bind ephemeral port for sidecar allocation");
    let port = listener
        .local_addr()
        .expect("failed to read local addr")
        .port();
    drop(listener);
    port
}

pub fn build_sidecar_command(
    port: u16,
    app_data_dir: &Path,
    log_dir: &Path,
    app_version: &str,
) -> std::process::Command {
    let mut cmd = std::process::Command::new("bun");
    cmd.args(["run", "sidecars/api/src/server.ts"]);
    cmd.env("MINERADIO_SIDECAR_PORT", port.to_string());
    cmd.env("MINERADIO_APP_DATA_DIR", app_data_dir);
    cmd.env("MINERADIO_LOG_DIR", log_dir);
    cmd.env("MINERADIO_APP_VERSION", app_version);
    cmd
}

pub fn spawn_sidecar(
    mut cmd: std::process::Command,
) -> Result<std::process::Child, SidecarError> {
    cmd.spawn().map_err(|e| SidecarError::Io(e.to_string()))
}

pub fn parse_health_response(body: &[u8]) -> Result<HealthInfo, SidecarError> {
    let text = std::str::from_utf8(body).map_err(|e| SidecarError::Parse(e.to_string()))?;
    let value: serde_json::Value =
        serde_json::from_str(text).map_err(|e| SidecarError::Parse(e.to_string()))?;
    let ok = value
        .get("ok")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| SidecarError::Parse("missing ok".into()))?;
    if !ok {
        return Err(SidecarError::BadStatus);
    }
    let app_version = value
        .get("appVersion")
        .and_then(|v| v.as_str())
        .ok_or_else(|| SidecarError::Parse("missing appVersion".into()))?
        .to_string();
    let api_version = value
        .get("apiVersion")
        .and_then(|v| v.as_str())
        .ok_or_else(|| SidecarError::Parse("missing apiVersion".into()))?
        .to_string();
    let schema_version = value
        .get("schemaVersion")
        .and_then(|v| v.as_str())
        .ok_or_else(|| SidecarError::Parse("missing schemaVersion".into()))?
        .to_string();
    Ok(HealthInfo {
        ok,
        app_version,
        api_version,
        schema_version,
    })
}

fn parse_base_url(base_url: &str) -> Result<(String, u16), SidecarError> {
    let rest = base_url.strip_prefix("http://").ok_or(SidecarError::BadUrl)?;
    let host_port = rest.split('/').next().ok_or(SidecarError::BadUrl)?;
    let (host, port) = match host_port.rsplit_once(':') {
        Some((h, p)) => (h.to_string(), p.parse::<u16>().map_err(|_| SidecarError::BadUrl)?),
        None => return Err(SidecarError::BadUrl),
    };
    if host.is_empty() {
        return Err(SidecarError::BadUrl);
    }
    Ok((host, port))
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n")
}

fn try_health_once(host: &str, port: u16) -> Result<HealthInfo, SidecarError> {
    use std::io::{Read, Write};
    let mut stream = std::net::TcpStream::connect((host, port))
        .map_err(|e| SidecarError::Io(e.to_string()))?;
    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(2)))
        .ok();
    let req = format!(
        "GET /health HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        host
    );
    stream
        .write_all(req.as_bytes())
        .map_err(|e| SidecarError::Io(e.to_string()))?;
    let mut buf = Vec::new();
    let mut chunk = [0u8; 1024];
    loop {
        let n = stream
            .read(&mut chunk)
            .map_err(|e| SidecarError::Io(e.to_string()))?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() > (1 << 20) {
            return Err(SidecarError::Parse("response too large".into()));
        }
    }
    let header_end = find_header_end(&buf)
        .ok_or_else(|| SidecarError::Parse("no header terminator".into()))?;
    let header_bytes = &buf[..header_end];
    let header_str = std::str::from_utf8(header_bytes)
        .map_err(|e| SidecarError::Parse(e.to_string()))?;
    let status_line = header_str.lines().next().unwrap_or("");
    if !status_line.contains(" 200 ") {
        return Err(SidecarError::BadStatus);
    }
    let body = &buf[header_end + 4..];
    parse_health_response(body)
}

pub fn wait_for_health(
    base_url: &str,
    deadline: std::time::Duration,
) -> Result<HealthInfo, SidecarError> {
    let (host, port) = parse_base_url(base_url)?;
    let start = std::time::Instant::now();
    loop {
        match try_health_once(&host, port) {
            Ok(info) => return Ok(info),
            Err(_) => {
                if start.elapsed() >= deadline {
                    return Err(SidecarError::Timeout);
                }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn allocate_port_returns_nonzero() {
        let port = allocate_port();
        assert!(port > 0);
    }

    #[test]
    fn build_sidecar_command_sets_program_args_and_env() {
        let cmd = build_sidecar_command(
            54321,
            Path::new("/tmp/data"),
            Path::new("/tmp/logs"),
            "1.2.3",
        );
        let program = cmd.get_program();
        assert_eq!(program, std::ffi::OsStr::new("bun"));

        let args: Vec<String> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert_eq!(args, vec!["run", "sidecars/api/src/server.ts"]);

        let envs: Vec<(&std::ffi::OsStr, Option<&std::ffi::OsStr>)> =
            cmd.get_envs().collect();
        let get = |key: &str| -> Option<String> {
            envs.iter().find_map(|(k, v)| {
                if k.to_str() == Some(key) {
                    v.as_ref().and_then(|x| x.to_str()).map(|s| s.to_string())
                } else {
                    None
                }
            })
        };
        assert_eq!(get("MINERADIO_SIDECAR_PORT"), Some("54321".to_string()));
        assert_eq!(get("MINERADIO_APP_VERSION"), Some("1.2.3".to_string()));
        assert_eq!(get("MINERADIO_APP_DATA_DIR"), Some("/tmp/data".to_string()));
        assert_eq!(get("MINERADIO_LOG_DIR"), Some("/tmp/logs".to_string()));
    }

    #[test]
    fn parse_health_response_ok_body() {
        let body = br#"{"ok":true,"appVersion":"x","apiVersion":"0.1.0","schemaVersion":"0.1.0","providers":[]}"#;
        let info = parse_health_response(body).expect("should parse");
        assert!(info.ok);
        assert_eq!(info.app_version, "x");
        assert_eq!(info.api_version, "0.1.0");
        assert_eq!(info.schema_version, "0.1.0");
    }

    #[test]
    fn parse_health_response_rejects_ok_false() {
        let body = br#"{"ok":false,"appVersion":"x","apiVersion":"0.1.0","schemaVersion":"0.1.0"}"#;
        let err = parse_health_response(body).expect_err("should reject");
        assert!(matches!(err, SidecarError::BadStatus));
    }

    #[test]
    fn parse_health_response_rejects_garbage() {
        let err = parse_health_response(b"not json").expect_err("should reject");
        assert!(matches!(err, SidecarError::Parse(_)));
    }

    #[test]
    fn wait_for_health_succeeds_against_test_listener() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let body = br#"{"ok":true,"appVersion":"x","apiVersion":"0.1.0","schemaVersion":"0.1.0","providers":[]}"#.to_vec();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                if let Ok(mut stream) = stream {
                    let mut req = [0u8; 4096];
                    let _ = std::io::Read::read(&mut stream, &mut req);
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    let _ = stream.write_all(&body);
                    let _ = stream.flush();
                    let _ = stream.shutdown(std::net::Shutdown::Both);
                }
            }
        });
        let base_url = format!("http://127.0.0.1:{}", port);
        let info = wait_for_health(&base_url, std::time::Duration::from_secs(3))
            .expect("should succeed against in-test listener");
        assert!(info.ok);
        assert_eq!(info.app_version, "x");
        assert_eq!(info.api_version, "0.1.0");
        assert_eq!(info.schema_version, "0.1.0");
    }

    #[test]
    fn wait_for_health_times_out_against_unbound_port() {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        drop(l);
        let base_url = format!("http://127.0.0.1:{}", port);
        let result = wait_for_health(&base_url, std::time::Duration::from_millis(150));
        assert!(matches!(result, Err(SidecarError::Timeout)));
    }

    #[test]
    fn wait_for_health_rejects_bad_url() {
        let result = wait_for_health("not-a-url", std::time::Duration::from_millis(50));
        assert!(matches!(result, Err(SidecarError::BadUrl)));
    }
}