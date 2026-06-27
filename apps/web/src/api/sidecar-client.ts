import {
	ApiFailureSchema,
	ApiSuccessSchema,
	CapabilityMatrixSchema,
	CapabilityMatrix,
	HealthResponse,
	HealthResponseSchema,
} from "@mineradio/shared";

export interface SidecarClientErrorInit {
	code: string;
	message: string;
	provider?: string;
	retryable: boolean;
}

export class SidecarClientError extends Error {
	readonly code: string;
	readonly provider?: string;
	readonly retryable: boolean;

	constructor(init: SidecarClientErrorInit) {
		super(init.message);
		this.name = "SidecarClientError";
		this.code = init.code;
		this.provider = init.provider;
		this.retryable = init.retryable;
	}
}

const CapabilitySuccessEnvelopeSchema = ApiSuccessSchema(CapabilityMatrixSchema);

type FetchImpl = typeof fetch;

export class SidecarClient {
	private readonly baseUrl: string;
	private readonly fetchImpl: FetchImpl;

	constructor(baseUrl: string, fetchImpl: FetchImpl = fetch) {
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.fetchImpl = fetchImpl;
	}

	async health(): Promise<HealthResponse> {
		const res = await this.fetchImpl(`${this.baseUrl}/health`);
		if (!res.ok) {
			throw new SidecarClientError({
				code: `HTTP_${res.status}`,
				message: `health request failed with status ${res.status}`,
				retryable: res.status >= 500 || res.status === 429,
			});
		}
		const json = (await res.json()) as unknown;
		const failure = ApiFailureSchema.safeParse(json);
		if (failure.success) {
			throw new SidecarClientError({
				code: failure.data.error.code,
				message: failure.data.error.message,
				provider: failure.data.error.provider,
				retryable: failure.data.error.retryable,
			});
		}
		const parsed = HealthResponseSchema.safeParse(json);
		if (!parsed.success) {
			throw new SidecarClientError({
				code: "SCHEMA",
				message: "health response failed schema validation",
				retryable: false,
			});
		}
		return parsed.data;
	}

	async capabilities(): Promise<CapabilityMatrix> {
		const res = await this.fetchImpl(`${this.baseUrl}/providers/capabilities`);
		if (!res.ok) {
			throw new SidecarClientError({
				code: `HTTP_${res.status}`,
				message: `capabilities request failed with status ${res.status}`,
				retryable: res.status >= 500 || res.status === 429,
			});
		}
		const json = (await res.json()) as unknown;
		const failure = ApiFailureSchema.safeParse(json);
		if (failure.success) {
			throw new SidecarClientError({
				code: failure.data.error.code,
				message: failure.data.error.message,
				provider: failure.data.error.provider,
				retryable: failure.data.error.retryable,
			});
		}
		const envelope = CapabilitySuccessEnvelopeSchema.safeParse(json);
		if (!envelope.success) {
			throw new SidecarClientError({
				code: "SCHEMA",
				message: "capabilities response failed schema validation",
				retryable: false,
			});
		}
		return envelope.data.data;
	}
}