export function port(): number {
  const raw = process.env.MINERADIO_SIDECAR_PORT ?? "0";
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function appVersion(): string {
  return process.env.MINERADIO_APP_VERSION || "0.0.0-dev";
}

export function apiVersion(): string {
  return process.env.MINERADIO_API_VERSION || "0.1.0";
}

export function schemaVersion(): string {
  return process.env.MINERADIO_SCHEMA_VERSION || "0.1.0";
}