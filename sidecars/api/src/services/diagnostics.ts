import type { CapabilityMatrix, ProviderStatusEntry } from "@mineradio/shared";
import { appVersion, apiVersion, schemaVersion } from "../env";
import { buildCapabilityMatrix } from "../providers/registry";
import { redactLogValue } from "./sidecar-log";

const RECENT_ERRORS_MAX = 20;
const recentErrors: unknown[] = [];

export interface DiagnosticsDeps {
  capabilityMatrix?: () => CapabilityMatrix;
}

export interface DiagnosticsPayload {
  ok: true;
  appVersion: string;
  apiVersion: string;
  schemaVersion: string;
  providers: ProviderStatusEntry[];
  recentErrors: unknown[];
}

export function buildDiagnostics(deps: DiagnosticsDeps = {}): DiagnosticsPayload {
  const matrix = deps.capabilityMatrix ? deps.capabilityMatrix() : buildCapabilityMatrix();
  return {
    ok: true,
    appVersion: appVersion(),
    apiVersion: apiVersion(),
    schemaVersion: schemaVersion(),
    providers: matrix.providers,
    recentErrors: recentErrors.map((entry) => redactLogValue(entry))
  };
}

export function pushRecentError(entry: unknown): void {
  recentErrors.push(entry);
  if (recentErrors.length > RECENT_ERRORS_MAX) {
    recentErrors.shift();
  }
}
