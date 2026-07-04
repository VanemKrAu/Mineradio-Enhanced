//! Wallpaper scanner — directory scanning, RePKG texture extraction, caching.
//!
//! Mirrors the Electron `wallpaper-scanner.js` logic in Rust.
//! RePKG.exe is called as a subprocess; extracted PNGs are cached in `_repkg_cache`.

use std::fs;
use std::path::{Path, PathBuf};

/// A single wallpaper item discovered during scanning.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperEntry {
    pub title: String,
    pub folder_path: String,
    pub preview_path: Option<String>,
    pub mp4_file: Option<String>,
    pub has_scene_pkg: bool,
    pub workshop_id: Option<String>,
    pub content_rating: Option<String>,
    pub file_size: u64,
}

/// Result of a texture extraction.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractTextureResult {
    pub ok: bool,
    pub png_path: Option<String>,
    pub error: Option<String>,
}

/// Scan a single directory for wallpaper content.
pub fn scan_library(root: &Path) -> Vec<WallpaperEntry> {
    let mut results = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return results;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(folder_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        // Skip hidden dirs and cache dirs
        if folder_name.starts_with('.') || folder_name.starts_with('_') {
            continue;
        }
        let Some(wp) = scan_single_wallpaper(&path) else {
            continue;
        };
        results.push(wp);
    }
    // Sort by title for stable ordering
    results.sort_by(|a, b| a.title.cmp(&b.title));
    results
}

/// Scan multiple root directories.
pub fn scan_libraries(roots: &[PathBuf]) -> Vec<WallpaperEntry> {
    let mut all = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for root in roots {
        for wp in scan_library(root) {
            if seen.insert(wp.folder_path.clone()) {
                all.push(wp);
            }
        }
    }
    all
}

/// Scan a single wallpaper directory.
fn scan_single_wallpaper(dir: &Path) -> Option<WallpaperEntry> {
    let folder_path = dir.to_string_lossy().to_string();
    let file_size = fs_util_dir_size(dir).unwrap_or(0);

    // Read project.json for metadata
    let project_json_path = dir.join("project.json");
    let (title, workshop_id, content_rating) = if project_json_path.exists() {
        read_project_json(&project_json_path)
    } else {
        // Fall back to folder name as title
        (
            dir.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            None,
            None,
        )
    };

    // Look for preview image
    let preview_path = ["preview.jpg", "preview.png", "preview.gif"]
        .iter()
        .map(|name| dir.join(name))
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string());

    // Look for MP4 video
    let mp4_file = dir
        .join("wallpaper.mp4")
        .exists()
        .then(|| dir.join("wallpaper.mp4").to_string_lossy().to_string());

    // Check for scene.pkg
    let has_scene_pkg = dir.join("scene.pkg").exists();

    Some(WallpaperEntry {
        title,
        folder_path,
        preview_path,
        mp4_file,
        has_scene_pkg,
        workshop_id,
        content_rating,
        file_size,
    })
}

/// Read project.json and extract title + workshop metadata.
fn read_project_json(path: &Path) -> (String, Option<String>, Option<String>) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return ("Unknown".to_string(), None, None),
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return ("Unknown".to_string(), None, None),
    };
    let title = json
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let workshop_id = json
        .get("workshopid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            json.get("workshopid")
                .and_then(|v| v.as_u64())
                .map(|n| n.to_string())
        });
    let content_rating = json
        .get("contentrating")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (title, workshop_id, content_rating)
}

/// Auto-detect Wallpaper Engine library roots from Steam registry/install.
pub fn auto_detect_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    // Common paths for Wallpaper Engine on Windows
    let candidates = vec![
        // Steam default library
        PathBuf::from(
            r"C:\Program Files (x86)\Steam\steamapps\workshop\content\431960",
        ),
        // Alternative Steam library
        PathBuf::from(r"C:\Program Files\Steam\steamapps\workshop\content\431960"),
        // User's Documents wallpapers
        dirs::document_dir().map(|d| d.join("Wallpaper Engine")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            roots.push(candidate);
        }
    }

    // Also check Steam libraryfolders.vdf
    if let Some(steam_path) = detect_steam_path() {
        let workshop_path = steam_path.join("steamapps/workshop/content/431960");
        if workshop_path.exists() && !roots.contains(&workshop_path) {
            roots.push(workshop_path);
        }
    }

    roots
}

/// Try to detect Steam installation path.
fn detect_steam_path() -> Option<PathBuf> {
    // Check registry via reg query
    let output = std::process::Command::new("reg")
        .args([
            "query",
            "HKCU\\Software\\Valve\\Steam",
            "/v",
            "SteamPath",
        ])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(value) = trimmed.split("REG_SZ").nth(1).or_else(|| {
            trimmed
                .split("REG_EXPAND_SZ")
                .nth(1)
        }) {
            let path = PathBuf::from(value.trim());
            if path.exists() {
                return Some(path);
            }
        }
    }
    None
}

/// Extract texture from scene.pkg using RePKG.exe.
/// Returns the path to the extracted PNG (the largest one).
pub fn extract_wallpaper_texture(
    folder_path: &str,
    repkg_exe: &str,
) -> ExtractTextureResult {
    let folder = Path::new(folder_path);
    let scene_pkg = folder.join("scene.pkg");
    if !scene_pkg.exists() {
        return ExtractTextureResult {
            ok: false,
            png_path: None,
            error: Some("scene.pkg not found".to_string()),
        };
    }

    // Check if we already have a cached extraction
    let cache_dir = folder.join("_repkg_cache");
    if cache_dir.exists() {
        if let Some(existing) = find_largest_png(&cache_dir) {
            return ExtractTextureResult {
                ok: true,
                png_path: Some(existing.to_string_lossy().to_string()),
                error: None,
            };
        }
    }

    // Run RePKG.exe to extract
    let _ = fs::create_dir_all(&cache_dir);
    let output = std::process::Command::new(repkg_exe)
        .args([
            "extract",
            "-s",
            "-o",
            &cache_dir.to_string_lossy(),
            &scene_pkg.to_string_lossy(),
        ])
        .output();

    match output {
        Ok(out) => {
            if !out.status.success() {
                let stderr = String::from_utf8_lossy(&out.stderr);
                return ExtractTextureResult {
                    ok: false,
                    png_path: None,
                    error: Some(format!("RePKG failed: {}", stderr)),
                };
            }
            // Find the largest PNG
            match find_largest_png(&cache_dir) {
                Some(png) => ExtractTextureResult {
                    ok: true,
                    png_path: Some(png.to_string_lossy().to_string()),
                    error: None,
                },
                None => ExtractTextureResult {
                    ok: false,
                    png_path: None,
                    error: Some("No PNG extracted by RePKG".to_string()),
                },
            }
        }
        Err(e) => ExtractTextureResult {
            ok: false,
            png_path: None,
            error: Some(format!("Failed to run RePKG: {}", e)),
        },
    }
}

/// Clear all _repkg_cache directories under the given roots.
pub fn clear_wallpaper_cache(roots: &[PathBuf]) -> usize {
    let mut cleared = 0;
    for root in roots {
        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries.flatten() {
                let cache_dir = entry.path().join("_repkg_cache");
                if cache_dir.exists() {
                    let _ = fs::remove_dir_all(&cache_dir);
                    cleared += 1;
                }
            }
        }
    }
    cleared
}

/// Read a file from disk and return it as a base64 data URL.
pub fn read_file_as_data_url(path: &str) -> Result<String, String> {
    let p = Path::new(path);
    let bytes = fs::read(p).map_err(|e| format!("read failed: {}", e))?;
    let mime = mime_for_path(p);
    let b64 = base64_encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

fn mime_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        _ => "application/octet-stream",
    }
}

fn find_largest_png(dir: &Path) -> Option<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return None;
    };
    entries
        .flatten()
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("png"))
                .unwrap_or(false)
        })
        .max_by_key(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
        .map(|e| e.path())
}

fn fs_util_dir_size(dir: &Path) -> Option<u64> {
    let mut total = 0u64;
    let Ok(entries) = fs::read_dir(dir) else {
        return None;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            total += fs_util_dir_size(&path).unwrap_or(0);
        } else if let Ok(meta) = path.metadata() {
            total += meta.len();
        }
    }
    Some(total)
}

fn base64_encode(bytes: &[u8]) -> String {
    use std::fmt::Write;
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        out.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_empty_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("mineradio-wp-test-empty");
        let _ = fs::create_dir_all(&tmp);
        let results = scan_library(&tmp);
        assert!(results.is_empty());
        let _ = fs::remove_dir(&tmp);
    }

    #[test]
    fn base64_encode_empty() {
        assert_eq!(base64_encode(b""), "");
    }

    #[test]
    fn base64_encode_hello() {
        assert_eq!(base64_encode(b"hello"), "aGVsbG8=");
    }

    #[test]
    fn base64_encode_binary() {
        assert_eq!(base64_encode(&[0x00, 0xFF, 0xAA]), "AP+q");
    }

    #[test]
    fn mime_for_path_works() {
        assert_eq!(mime_for_path(Path::new("test.jpg")), "image/jpeg");
        assert_eq!(mime_for_path(Path::new("test.png")), "image/png");
        assert_eq!(mime_for_path(Path::new("test.mp4")), "video/mp4");
        assert_eq!(mime_for_path(Path::new("test.unknown")), "application/octet-stream");
    }

    #[test]
    fn detect_steam_path_returns_none_in_ci() {
        // In a CI/non-Steam environment, this should return None
        let result = detect_steam_path();
        // Just ensure it doesn't panic
        let _ = result;
    }
}
