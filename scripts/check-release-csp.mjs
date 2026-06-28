import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_PATH = "apps/desktop/src-tauri/tauri.conf.json";
const REQUIRED_DIRECTIVE_SOURCES = new Map([
  ["default-src", ["'self'"]],
  ["script-src", ["'self'"]],
  ["style-src", ["'self'"]],
  ["img-src", ["'self'", "data:", "blob:", "http://127.0.0.1:*"]],
  ["media-src", ["'self'", "blob:", "http://127.0.0.1:*"]],
  ["connect-src", ["'self'", "http://127.0.0.1:*"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'none'"]],
  ["frame-ancestors", ["'none'"]]
]);
const FORBIDDEN_SOURCES = new Set(["*", "http:", "https:", "ws:", "wss:", "'unsafe-inline'", "'unsafe-eval'"]);

export function extractReleaseCspPolicy(tauriConfig) {
  return {
    csp: tauriConfig?.app?.security?.csp,
    devCsp: tauriConfig?.app?.security?.devCsp ?? tauriConfig?.app?.security?.["dev-csp"]
  };
}

export function parseCspDirectives(csp) {
  const directives = new Map();
  if (typeof csp !== "string") return directives;
  for (const rawDirective of csp.split(";")) {
    const parts = rawDirective.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    directives.set(parts[0], parts.slice(1));
  }
  return directives;
}

export function evaluateReleaseCspPolicy(policy) {
  const errors = [];
  const csp = policy?.csp;
  if (typeof csp !== "string" || csp.trim() === "") {
    return {
      ok: false,
      errors: ["app.security.csp must be a non-empty release CSP string"]
    };
  }
  if (policy?.devCsp != null && typeof policy.devCsp !== "string") {
    errors.push("app.security.devCsp must be a string when set");
  }

  const directives = parseCspDirectives(csp);
  for (const [directive, requiredSources] of REQUIRED_DIRECTIVE_SOURCES) {
    const sources = directives.get(directive);
    if (!sources) {
      errors.push(`CSP must include ${directive}`);
      continue;
    }
    for (const source of requiredSources) {
      if (!sources.includes(source)) {
        errors.push(`CSP ${directive} must include ${source}`);
      }
    }
  }

  for (const [directive, sources] of directives) {
    for (const source of sources) {
      if (FORBIDDEN_SOURCES.has(source)) {
        errors.push(`CSP ${directive} must not include ${source}`);
      }
      if (/^https?:\/\//.test(source) && source !== "http://127.0.0.1:*") {
        errors.push(`CSP ${directive} must not allow external origin ${source}; use the sidecar proxy`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function checkReleaseCsp(rootDir = process.cwd()) {
  const path = resolve(rootDir, CONFIG_PATH);
  if (!existsSync(path)) throw new Error(`${CONFIG_PATH} is missing`);
  const tauriConfig = JSON.parse(readFileSync(path, "utf8"));
  return evaluateReleaseCspPolicy(extractReleaseCspPolicy(tauriConfig));
}

if (import.meta.main) {
  const result = checkReleaseCsp(process.cwd());
  if (!result.ok) {
    console.error("Release CSP check failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("Release CSP check passed.");
}
