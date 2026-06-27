export interface RuntimeConfig {
	sidecarBaseUrl: string;
	appDataDir: string;
	appVersion: string;
	schemaVersion: string;
}

interface RawRuntimeConfig {
	sidecar_base_url: string;
	app_data_dir: string;
	app_version: string;
	schema_version: string;
}

export function isTauriRuntime(): boolean {
	if (typeof window === "undefined") return false;
	return (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;
}

function placeholderRuntimeConfig(): RuntimeConfig {
	return {
		sidecarBaseUrl: "",
		appDataDir: "",
		appVersion: "0.0.0-dev",
		schemaVersion: "0.1.0",
	};
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
	if (!isTauriRuntime()) {
		return placeholderRuntimeConfig();
	}
	try {
		const mod = await import("@tauri-apps/api/core");
		const invoke = mod.invoke as (cmd: string, args?: Record<string, unknown>) => Promise<RawRuntimeConfig>;
		const raw = await invoke("get_runtime_config");
		return {
			sidecarBaseUrl: raw.sidecar_base_url,
			appDataDir: raw.app_data_dir,
			appVersion: raw.app_version,
			schemaVersion: raw.schema_version,
		};
	} catch {
		return placeholderRuntimeConfig();
	}
}