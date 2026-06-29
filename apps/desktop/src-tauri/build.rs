fn main() {
    ensure_sidecar_binary_for_tauri();
    tauri_build::build();
}

fn ensure_sidecar_binary_for_tauri() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by Cargo"),
    );
    let target_triple = std::env::var("TARGET").expect("TARGET is set by Cargo");
    let exe = if target_triple.contains("windows") {
        ".exe"
    } else {
        ""
    };
    let sidecar = manifest_dir
        .join("binaries")
        .join(format!("mineradio-sidecar-api-{target_triple}{exe}"));
    println!(
        "cargo:rerun-if-changed={}",
        manifest_dir.join("../../sidecars/api/src").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        manifest_dir
            .join("../scripts/build-sidecar-binary.mjs")
            .display()
    );
    if sidecar.exists() {
        return;
    }

    let desktop_dir = manifest_dir
        .parent()
        .expect("src-tauri has a desktop package parent");
    let script = desktop_dir.join("scripts/build-sidecar-binary.mjs");
    let status = std::process::Command::new("bun")
        .arg("run")
        .arg(script)
        .env("TAURI_TARGET_TRIPLE", target_triple)
        .current_dir(desktop_dir)
        .status()
        .expect("failed to start bun to build Mineradio sidecar binary");
    if !status.success() {
        panic!("failed to build Mineradio sidecar binary");
    }
}
