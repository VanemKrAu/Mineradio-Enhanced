export interface RuntimeConfig {
	sidecarBaseUrl: string;
	appDataDir: string;
	appVersion: string;
	schemaVersion: string;
	updaterPublicKeyConfigured: boolean;
}

export type SidecarPhase = "starting" | "ready" | "recovering" | "stopped" | "error";

export interface SidecarStatus {
	phase: SidecarPhase;
	baseUrl: string;
	pid: number | null;
	restarts: number;
	lastError: string | null;
	lastHealthOkMs: number | null;
	providers: string[];
	logPath: string;
}

export type Unlisten = () => void;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ExportJsonFileResult {
	cancelled: boolean;
	path: string | null;
}

export interface ImportJsonFileResult {
	cancelled: boolean;
	path: string | null;
	data: JsonValue | null;
}

export interface GlobalHotkeyBinding {
	action: string;
	accelerator: string;
}

export interface GlobalHotkeyConflict {
	sourceName: string;
	sourceIcon: string;
	reason: string;
}

export interface GlobalHotkeyRegistrationResult {
	action: string;
	accelerator: string;
	ok: boolean;
	conflict?: GlobalHotkeyConflict;
}

export interface ConfigureGlobalHotkeysResult {
	ok: boolean;
	results: GlobalHotkeyRegistrationResult[];
}

export interface GlobalHotkeyEventPayload {
	action: string;
}

export type ProviderLoginId = "netease" | "qq";

export interface ProviderLoginWindowResult {
	provider: ProviderLoginId;
	stored: boolean;
	reused: boolean;
	partial: boolean;
}

interface RawRuntimeConfig {
	sidecar_base_url: string;
	app_data_dir: string;
	app_version: string;
	schema_version: string;
	updater_public_key_configured: boolean;
}

interface RawSidecarStatus {
	phase?: SidecarPhase;
	baseUrl?: string;
	pid?: number | null;
	restarts?: number;
	lastError?: string | null;
	lastHealthOkMs?: number | null;
	providers?: string[];
	logPath?: string;
}

export function isTauriRuntime(): boolean {
	if (typeof window === "undefined") return false;
	return (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;
}

export async function invokeTauriCommand<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
	if (!isTauriRuntime()) {
		return null;
	}
	const mod = await import("@tauri-apps/api/core");
	const invoke = mod.invoke as (cmd: string, args?: Record<string, unknown>) => Promise<T>;
	return invoke(cmd, args);
}

export async function listenTauriEvent<T = unknown>(
	eventName: string,
	handler: (payload: T) => void
): Promise<Unlisten> {
	if (!isTauriRuntime()) {
		return () => {};
	}
	const mod = await import("@tauri-apps/api/event");
	const listen = mod.listen as (
		eventName: string,
		handler: (event: { payload: T }) => void
	) => Promise<Unlisten>;
	return listen(eventName, (event) => handler(event.payload));
}

function placeholderRuntimeConfig(): RuntimeConfig {
	return {
		sidecarBaseUrl: "",
		appDataDir: "",
		appVersion: "0.0.0-dev",
		schemaVersion: "0.1.0",
		updaterPublicKeyConfigured: false,
	};
}

function placeholderSidecarStatus(): SidecarStatus {
	return {
		phase: "stopped",
		baseUrl: "",
		pid: null,
		restarts: 0,
		lastError: null,
		lastHealthOkMs: null,
		providers: [],
		logPath: "",
	};
}

function cancelledExportJsonResult(): ExportJsonFileResult {
	return {
		cancelled: true,
		path: null,
	};
}

function cancelledImportJsonResult(): ImportJsonFileResult {
	return {
		cancelled: true,
		path: null,
		data: null,
	};
}

function disabledGlobalHotkeysResult(): ConfigureGlobalHotkeysResult {
	return {
		ok: true,
		results: [],
	};
}

function providerLoginPlaceholder(provider: ProviderLoginId): ProviderLoginWindowResult {
	return {
		provider,
		stored: false,
		reused: false,
		partial: false,
	};
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
	if (!isTauriRuntime()) {
		return placeholderRuntimeConfig();
	}
	try {
		const raw = await invokeTauriCommand<RawRuntimeConfig>("get_runtime_config");
		if (!raw) {
			return placeholderRuntimeConfig();
		}
		return {
			sidecarBaseUrl: raw.sidecar_base_url,
			appDataDir: raw.app_data_dir,
			appVersion: raw.app_version,
			schemaVersion: raw.schema_version,
			updaterPublicKeyConfigured: raw.updater_public_key_configured,
		};
	} catch {
		return placeholderRuntimeConfig();
	}
}

export async function getSidecarStatus(): Promise<SidecarStatus> {
	if (!isTauriRuntime()) {
		return placeholderSidecarStatus();
	}
	try {
		const raw = await invokeTauriCommand<RawSidecarStatus>("get_sidecar_status");
		if (!raw) return placeholderSidecarStatus();
		return {
			phase: raw.phase ?? "stopped",
			baseUrl: raw.baseUrl ?? "",
			pid: raw.pid ?? null,
			restarts: raw.restarts ?? 0,
			lastError: raw.lastError ?? null,
			lastHealthOkMs: raw.lastHealthOkMs ?? null,
			providers: Array.isArray(raw.providers) ? raw.providers : [],
			logPath: raw.logPath ?? "",
		};
	} catch {
		return placeholderSidecarStatus();
	}
}

export async function exportJsonFile(fileName: string, data: JsonValue): Promise<ExportJsonFileResult> {
	if (!isTauriRuntime()) {
		return cancelledExportJsonResult();
	}
	const result = await invokeTauriCommand<ExportJsonFileResult>("export_json_file", { fileName, data });
	return result ?? cancelledExportJsonResult();
}

export async function importJsonFile(): Promise<ImportJsonFileResult> {
	if (!isTauriRuntime()) {
		return cancelledImportJsonResult();
	}
	const result = await invokeTauriCommand<ImportJsonFileResult>("import_json_file");
	return result ?? cancelledImportJsonResult();
}

export async function toggleWindowFullscreen(): Promise<void> {
	if (!isTauriRuntime()) return;
	await invokeTauriCommand("window_toggle_fullscreen");
}

export async function openExternalUrl(url: string): Promise<boolean> {
	if (!isTauriRuntime()) return false;
	try {
		await invokeTauriCommand("open_external", { url });
		return true;
	} catch {
		return false;
	}
}

export async function showDesktopLyricsWindow(): Promise<void> {
	if (!isTauriRuntime()) return;
	await invokeTauriCommand("desktop_lyrics_show_window");
}

export async function closeDesktopLyricsWindow(): Promise<void> {
	if (!isTauriRuntime()) return;
	await invokeTauriCommand("desktop_lyrics_close_window");
}

export async function updateDesktopLyricsPayload(payload: JsonValue): Promise<void> {
	if (!isTauriRuntime()) return;
	await invokeTauriCommand("desktop_lyrics_update_payload", { payload });
}

export async function configureGlobalHotkeys(bindings: GlobalHotkeyBinding[]): Promise<ConfigureGlobalHotkeysResult> {
	if (!isTauriRuntime()) {
		return disabledGlobalHotkeysResult();
	}
	const result = await invokeTauriCommand<ConfigureGlobalHotkeysResult>("configure_global_hotkeys", { bindings });
	return result ?? disabledGlobalHotkeysResult();
}

export async function listenGlobalHotkey(handler: (payload: GlobalHotkeyEventPayload) => void): Promise<Unlisten> {
	return listenTauriEvent<GlobalHotkeyEventPayload>("mineradio-global-hotkey", handler);
}

export async function openProviderLoginWindow(provider: ProviderLoginId): Promise<ProviderLoginWindowResult> {
	if (!isTauriRuntime()) {
		return providerLoginPlaceholder(provider);
	}
	const command = provider === "qq" ? "login_qq_complete" : "login_netease_complete";
	const result = await invokeTauriCommand<ProviderLoginWindowResult>(command);
	return result ?? providerLoginPlaceholder(provider);
}
