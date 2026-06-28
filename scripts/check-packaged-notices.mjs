import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_PATH = "apps/desktop/src-tauri/tauri.conf.json";
const REQUIRED_RESOURCES = [
  "../../../LICENSE",
  "../../../NOTICE.md",
  "../../../THIRD_PARTY_NOTICES.md",
  "../../../PRIVACY.md",
  "../../../SECURITY.md"
];

export function extractPackagedNoticesPolicy(tauriConfig) {
  return {
    resources: tauriConfig?.bundle?.resources
  };
}

export function evaluatePackagedNoticesPolicy(policy, options = {}) {
  const errors = [];
  const resources = Array.isArray(policy?.resources) ? policy.resources : [];
  for (const resource of REQUIRED_RESOURCES) {
    if (!resources.includes(resource)) {
      errors.push(`bundle.resources must include ${resource}`);
    }
  }

  const rootDir = options.rootDir;
  if (rootDir) {
    for (const resource of REQUIRED_RESOURCES) {
      const repoRelative = resource.replace(/^\.\.\/\.\.\/\.\.\//, "");
      if (!existsSync(resolve(rootDir, repoRelative))) {
        errors.push(`${repoRelative} must exist before it can be packaged`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function checkPackagedNotices(rootDir = process.cwd()) {
  const path = resolve(rootDir, CONFIG_PATH);
  if (!existsSync(path)) throw new Error(`${CONFIG_PATH} is missing`);
  const tauriConfig = JSON.parse(readFileSync(path, "utf8"));
  return evaluatePackagedNoticesPolicy(extractPackagedNoticesPolicy(tauriConfig), { rootDir });
}

if (import.meta.main) {
  const result = checkPackagedNotices(process.cwd());
  if (!result.ok) {
    console.error("Packaged notices check failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("Packaged notices check passed.");
}
