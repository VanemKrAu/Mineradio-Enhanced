import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED = {
  productName: "Mineradio Tauri Rewrite",
  identifier: "com.mineradio.fork.tauri",
  version: "0.1.0",
  cargoName: "mineradio-tauri",
  license: "GPL-3.0",
  updaterRepo: "zzstar101/Mineradio",
  icon: "icons/icon.ico",
  deferredIdentityCapability: "Tauri 发布 logo / 最终品牌名"
};

const DEFERRED_TABLE_HEADER = "| Capability | Status | 延期原因 | 补齐条件 | 发布前决策 |";

export function parseCargoPackageFields(toml) {
  const fields = {};
  let inPackage = false;
  for (const rawLine of toml.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      inPackage = section[1].trim() === "package";
      continue;
    }
    if (!inPackage) continue;
    const field = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/);
    if (field) fields[field[1]] = field[2];
  }
  return fields;
}

export function parseDeferredCapabilityRows(markdown) {
  const rows = new Map();
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === DEFERRED_TABLE_HEADER);
  if (headerIndex < 0) return rows;
  for (const rawLine of lines.slice(headerIndex + 2)) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) break;
    const cells = splitMarkdownTableRow(line);
    if (cells.length < 5) continue;
    const capability = cleanMarkdownCell(cells[0]);
    if (!capability || capability === "---") continue;
    rows.set(capability, {
      capability,
      status: cleanMarkdownCell(cells[1]),
      reason: cleanMarkdownCell(cells[2]),
      condition: cleanMarkdownCell(cells[3]),
      releaseDecision: cleanMarkdownCell(cells[4])
    });
  }
  return rows;
}

export function evaluateReleaseIdentity(input) {
  const errors = [];
  const cfg = input.tauriConfig ?? {};
  if (cfg.identifier !== EXPECTED.identifier) {
    errors.push(`tauri.conf.json identifier must stay ${EXPECTED.identifier}`);
  }
  if (cfg.productName !== EXPECTED.productName) {
    errors.push(`tauri.conf.json productName must stay ${EXPECTED.productName}`);
  }
  if (cfg.version !== EXPECTED.version) {
    errors.push(`tauri.conf.json version must stay ${EXPECTED.version} until release versioning is explicitly changed`);
  }

  const mainWindow = Array.isArray(cfg.app?.windows)
    ? cfg.app.windows.find((window) => window?.label === "main") ?? cfg.app.windows[0]
    : null;
  if (mainWindow?.title !== EXPECTED.productName) {
    errors.push(`main Tauri window title must stay ${EXPECTED.productName}`);
  }
  if (!Array.isArray(cfg.bundle?.icon) || !cfg.bundle.icon.includes(EXPECTED.icon)) {
    errors.push(`tauri.conf.json bundle.icon must include ${EXPECTED.icon}`);
  }
  const endpoints = cfg.plugins?.updater?.endpoints;
  if (!Array.isArray(endpoints) || !endpoints.some((endpoint) => String(endpoint).includes(EXPECTED.updaterRepo))) {
    errors.push(`updater endpoint must point at ${EXPECTED.updaterRepo}`);
  }

  if (input.cargoPackage?.name !== EXPECTED.cargoName) {
    errors.push(`Cargo package name must stay ${EXPECTED.cargoName}`);
  }
  if (input.cargoPackage?.version !== EXPECTED.version) {
    errors.push(`Cargo package version must stay ${EXPECTED.version} until release versioning is explicitly changed`);
  }
  if (input.cargoPackage?.license !== EXPECTED.license) {
    errors.push(`Cargo package license must stay ${EXPECTED.license}`);
  }
  if (input.desktopPackage?.version !== EXPECTED.version) {
    errors.push(`apps/desktop/package.json version must stay ${EXPECTED.version} until release versioning is explicitly changed`);
  }

  for (const [label, text] of [
    ["README.md", input.readme],
    ["NOTICE.md", input.notice],
    ["THIRD_PARTY_NOTICES.md", input.thirdPartyNotices]
  ]) {
    if (!String(text ?? "").includes(EXPECTED.productName)) {
      errors.push(`${label} must mention ${EXPECTED.productName}`);
    }
    if (!String(text ?? "").includes(EXPECTED.license)) {
      errors.push(`${label} must mention ${EXPECTED.license}`);
    }
  }

  const deferredRows = parseDeferredCapabilityRows(String(input.deferredCapabilities ?? ""));
  const identityRow = deferredRows.get(EXPECTED.deferredIdentityCapability);
  if (identityRow?.status !== "done") {
    errors.push(`DEFERRED_CAPABILITIES.md must mark ${EXPECTED.deferredIdentityCapability} as done`);
  }

  return { ok: errors.length === 0, errors };
}

export function checkReleaseIdentity(rootDir = process.cwd()) {
  const readJson = (path) => JSON.parse(readRequired(rootDir, path));
  const tauriConfig = readJson("apps/desktop/src-tauri/tauri.conf.json");
  const cargoPackage = parseCargoPackageFields(readRequired(rootDir, "apps/desktop/src-tauri/Cargo.toml"));
  const desktopPackage = readJson("apps/desktop/package.json");
  return evaluateReleaseIdentity({
    tauriConfig,
    cargoPackage,
    desktopPackage,
    readme: readRequired(rootDir, "README.md"),
    notice: readRequired(rootDir, "NOTICE.md"),
    thirdPartyNotices: readRequired(rootDir, "THIRD_PARTY_NOTICES.md"),
    deferredCapabilities: readRequired(rootDir, "docs/migration/DEFERRED_CAPABILITIES.md")
  });
}

function readRequired(rootDir, relativePath) {
  const path = resolve(rootDir, relativePath);
  if (!existsSync(path)) throw new Error(`${relativePath} is missing`);
  return readFileSync(path, "utf8");
}

function stripTomlComment(line) {
  const index = line.indexOf("#");
  return index >= 0 ? line.slice(0, index) : line;
}

function splitMarkdownTableRow(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function cleanMarkdownCell(cell) {
  return cell
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .trim();
}

if (import.meta.main) {
  const result = checkReleaseIdentity(process.cwd());
  if (!result.ok) {
    console.error("Release identity check failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("Release identity check passed.");
}
