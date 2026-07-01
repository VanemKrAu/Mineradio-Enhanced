import { invokeTauriCommand, isTauriRuntime } from "./runtime";

export type UpdateInstallState =
	| "ready-to-download"
	| "signature-key-missing"
	| "check-failed"
	| "not-available";

export interface UpdateCheckResult {
	available: boolean;
	version: string | null;
	currentVersion: string;
	body: string | null;
	message: string | null;
	date: string | null;
	error: string | null;
	requiresSignature: boolean;
	signatureGate: boolean;
	installState: UpdateInstallState;
}

interface RawUpdateCheckResult {
	available: boolean;
	version: string | null;
	current_version: string;
	body: string | null;
	message: string | null;
	date: string | null;
	error: string | null;
	requires_signature: boolean;
	signature_gate: boolean;
	install_state: UpdateInstallState;
}

type MockUpdateMode = "available" | "signature" | "error" | "none";

interface ImportMetaEnvLike {
	DEV?: boolean;
	MODE?: string;
}

function isDevUpdatePreviewEnabled(): boolean {
	const env = (import.meta as { env?: ImportMetaEnvLike }).env;
	if (typeof env?.DEV === "boolean") return env.DEV;
	if (env?.MODE) return env.MODE !== "production";
	const nodeEnv = (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
	return nodeEnv !== "production";
}

function mockUpdateModeFromLocation(): MockUpdateMode | null {
	if (!isDevUpdatePreviewEnabled()) return null;
	if (typeof window === "undefined") return null;
	const mode = new URLSearchParams(window.location?.search ?? "").get("mockUpdate")?.trim().toLowerCase();
	if (mode === "available" || mode === "signature" || mode === "error" || mode === "none") return mode;
	return null;
}

export function shouldOpenDevUpdatePreview(): boolean {
	if (mockUpdateModeFromLocation() === null) return false;
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location?.search ?? "").get("mockUpdateOpen") === "1";
}

function placeholderUpdateCheckResult(): UpdateCheckResult {
	return {
		available: false,
		version: null,
		currentVersion: "0.0.0-dev",
		body: null,
		message: null,
		date: null,
		error: null,
		requiresSignature: true,
		signatureGate: true,
		installState: "signature-key-missing",
	};
}

function availablePreviewUpdate(signatureGate: boolean): UpdateCheckResult {
	return {
		available: true,
		version: "0.2.0",
		currentVersion: "0.1.0",
		body: [
			"模拟更新：修复播放链路",
			"模拟更新：优化 3D 歌单架",
			"模拟更新：提升桌面歌词稳定性",
		].join("\n"),
		message: signatureGate ? "模拟更新可用，但签名密钥未配置。" : "模拟更新可用，准备下载并安装。",
		date: "2026-07-01T00:00:00Z",
		error: null,
		requiresSignature: true,
		signatureGate,
		installState: signatureGate ? "signature-key-missing" : "ready-to-download",
	};
}

function devPreviewUpdateCheckResult(): UpdateCheckResult | null {
	const mode = mockUpdateModeFromLocation();
	if (mode === "available") return availablePreviewUpdate(false);
	if (mode === "signature") return availablePreviewUpdate(true);
	if (mode === "error") {
		return {
			available: false,
			version: null,
			currentVersion: "0.1.0",
			body: null,
			message: "模拟更新检测失败。",
			date: null,
			error: "UPDATER_CHECK_FAILED",
			requiresSignature: true,
			signatureGate: false,
			installState: "check-failed",
		};
	}
	if (mode === "none") {
		return {
			available: false,
			version: null,
			currentVersion: "0.1.0",
			body: null,
			message: "模拟当前已是最新版本。",
			date: null,
			error: null,
			requiresSignature: true,
			signatureGate: false,
			installState: "not-available",
		};
	}
	return null;
}

function mapUpdateCheckResult(raw: RawUpdateCheckResult): UpdateCheckResult {
	return {
		available: raw.available,
		version: raw.version,
		currentVersion: raw.current_version,
		body: raw.body,
		message: raw.message,
		date: raw.date,
		error: raw.error,
		requiresSignature: raw.requires_signature,
		signatureGate: raw.signature_gate,
		installState: raw.install_state,
	};
}

export async function getUpdaterStatus(): Promise<UpdateCheckResult> {
	const preview = devPreviewUpdateCheckResult();
	if (preview) return preview;
	if (!isTauriRuntime()) {
		return placeholderUpdateCheckResult();
	}
	const raw = await invokeTauriCommand<RawUpdateCheckResult>("get_updater_status");
	return raw ? mapUpdateCheckResult(raw) : placeholderUpdateCheckResult();
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
	const preview = devPreviewUpdateCheckResult();
	if (preview) return preview;
	if (!isTauriRuntime()) {
		return placeholderUpdateCheckResult();
	}
	const raw = await invokeTauriCommand<RawUpdateCheckResult>("check_for_update");
	return raw ? mapUpdateCheckResult(raw) : placeholderUpdateCheckResult();
}

export async function installUpdate(): Promise<UpdateCheckResult> {
	const preview = devPreviewUpdateCheckResult();
	if (preview) return preview;
	if (!isTauriRuntime()) {
		return placeholderUpdateCheckResult();
	}
	const raw = await invokeTauriCommand<RawUpdateCheckResult>("install_update");
	return raw ? mapUpdateCheckResult(raw) : placeholderUpdateCheckResult();
}
