import { expect, test } from "bun:test";
import { useProviderStore } from "./provider-store";

test("setMatrix derives provider status from the matrix", () => {
	useProviderStore.getState().reset();
	useProviderStore.getState().setMatrix({
		version: "0.1.0",
		providers: [
			{ providerId: "netease", available: true, capabilities: [], message: "ok" },
			{ providerId: "qq", available: false, capabilities: [], message: "pending" },
		],
	});
	const status = useProviderStore.getState().status;
	expect(status?.netease.available).toBe(true);
	expect(status?.netease.message).toBe("ok");
	expect(status?.qq.available).toBe(false);
	expect(status?.qq.message).toBe("pending");
});