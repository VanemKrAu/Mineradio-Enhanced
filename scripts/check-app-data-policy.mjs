import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = {
  tauriConfig: "apps/desktop/src-tauri/tauri.conf.json",
  pathsRust: "apps/desktop/src-tauri/src/paths.rs"
};

const EXPECTED = {
  productName: "Mineradio Tauri Rewrite",
  identifier: "com.mineradio.fork.tauri",
  updaterRepo: "zzstar101/Mineradio"
};

export function extractAppDataPolicy(input) {
  const cfg = input?.tauriConfig ?? {};
  return {
    productName: cfg.productName,
    identifier: cfg.identifier,
    startMenuFolder: cfg.bundle?.windows?.nsis?.startMenuFolder,
    updaterEndpoints: cfg.plugins?.updater?.endpoints,
    pathsRust: input?.pathsRust ?? ""
  };
}

export function evaluateAppDataPolicy(policy) {
  const errors = [];
  const pathsRust = String(policy?.pathsRust ?? "");
  const endpoints = Array.isArray(policy?.updaterEndpoints)
    ? policy.updaterEndpoints.map(String)
    : [];

  if (policy?.productName !== EXPECTED.productName) {
    errors.push(`Tauri productName must stay ${EXPECTED.productName}`);
  }
  if (policy?.identifier !== EXPECTED.identifier) {
    errors.push(`Tauri identifier must stay ${EXPECTED.identifier}`);
  }
  if (policy?.startMenuFolder !== EXPECTED.productName) {
    errors.push(`NSIS startMenuFolder must stay ${EXPECTED.productName}`);
  }
  if (!endpoints.some((endpoint) => endpoint.includes(EXPECTED.updaterRepo))) {
    errors.push(`updater endpoint must stay on ${EXPECTED.updaterRepo}`);
  }
  if (!pathsRust.includes(EXPECTED.productName)) {
    errors.push(`Rust app data fallback must use ${EXPECTED.productName}`);
  }
  if (/\.join\(\s*["']Mineradio["']\s*\)/.test(pathsRust)) {
    errors.push("Rust app data fallback must not use the legacy bare Mineradio directory");
  }

  return { ok: errors.length === 0, errors };
}

export function checkAppDataPolicy(rootDir = process.cwd()) {
  const tauriConfig = JSON.parse(readRequired(rootDir, FILES.tauriConfig));
  return evaluateAppDataPolicy(extractAppDataPolicy({
    tauriConfig,
    pathsRust: readRequired(rootDir, FILES.pathsRust)
  }));
}

function readRequired(rootDir, relativePath) {
  const path = resolve(rootDir, relativePath);
  if (!existsSync(path)) throw new Error(`${relativePath} is missing`);
  return readFileSync(path, "utf8");
}

if (import.meta.main) {
  const result = checkAppDataPolicy(process.cwd());
  if (!result.ok) {
    console.error("App data policy check failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("App data policy check passed.");
}
