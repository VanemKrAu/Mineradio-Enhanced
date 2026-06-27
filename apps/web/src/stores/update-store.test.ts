import { expect, test } from "bun:test";
import { useUpdateStore } from "./update-store";

test("setStatus and setVersion update the store", () => {
	useUpdateStore.getState().reset();
	useUpdateStore.getState().setStatus("available");
	useUpdateStore.getState().setVersion("1.2.3");
	expect(useUpdateStore.getState().status).toBe("available");
	expect(useUpdateStore.getState().version).toBe("1.2.3");
});