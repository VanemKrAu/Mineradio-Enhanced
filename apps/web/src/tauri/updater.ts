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
	if (!isTauriRuntime()) {
		return placeholderUpdateCheckResult();
	}
	const raw = await invokeTauriCommand<RawUpdateCheckResult>("get_updater_status");
	return raw ? mapUpdateCheckResult(raw) : placeholderUpdateCheckResult();
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
	if (!isTauriRuntime()) {
		return placeholderUpdateCheckResult();
	}
	const raw = await invokeTauriCommand<RawUpdateCheckResult>("check_for_update");
	return raw ? mapUpdateCheckResult(raw) : placeholderUpdateCheckResult();
}
