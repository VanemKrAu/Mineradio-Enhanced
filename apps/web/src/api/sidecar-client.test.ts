import { expect, test } from "bun:test";
import { SidecarClient, SidecarClientError } from "./sidecar-client";

const BASE = "http://127.0.0.1:65535";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

test("health parses a valid HealthResponse", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = (async () =>
		jsonResponse({
			ok: true,
			appVersion: "0.9.0",
			apiVersion: "0.1.0",
			schemaVersion: "0.1.0",
			providers: [],
		})) as typeof fetch;
	try {
		const client = new SidecarClient(BASE);
		const h = await client.health();
		expect(h.ok).toBe(true);
		expect(h.apiVersion).toBe("0.1.0");
		expect(h.providers).toEqual([]);
	} finally {
		globalThis.fetch = original;
	}
});

test("health 500 throws SidecarClientError", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = (async () => new Response("", { status: 500 })) as typeof fetch;
	try {
		const client = new SidecarClient(BASE);
		let caught: unknown = null;
		try {
			await client.health();
		} catch (e) {
			caught = e;
		}
		expect(caught instanceof SidecarClientError).toBe(true);
		expect((caught as SidecarClientError).code).toBe("HTTP_500");
		expect((caught as SidecarClientError).retryable).toBe(true);
	} finally {
		globalThis.fetch = original;
	}
});

test("capabilities parses a valid success envelope", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = (async () =>
		jsonResponse({
			ok: true,
			data: {
				version: "0.1.0",
				providers: [
					{
						providerId: "netease",
						available: false,
						capabilities: [],
						message: "pending",
					},
				],
			},
		})) as typeof fetch;
	try {
		const client = new SidecarClient(BASE);
		const matrix = await client.capabilities();
		expect(matrix.version).toBe("0.1.0");
		expect(matrix.providers.length).toBe(1);
		expect(matrix.providers[0].providerId).toBe("netease");
	} finally {
		globalThis.fetch = original;
	}
});