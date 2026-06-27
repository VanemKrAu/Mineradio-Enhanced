import { expect, test } from "bun:test";
import { providers, buildCapabilityMatrix, PROVIDER_IDS } from "./registry";

test("registry exposes netease and qq adapters", () => {
  expect(providers.netease.id).toBe("netease");
  expect(providers.qq.id).toBe("qq");
  expect(PROVIDER_IDS).toEqual(["netease", "qq"]);
});

test("capability matrix lists both providers unavailable with empty capabilities", () => {
  const m = buildCapabilityMatrix();
  expect(m.providers.length).toBe(2);
  for (const e of m.providers) {
    expect(e.available).toBe(false);
    expect(e.capabilities.length).toBe(0);
  }
});