import { expect, test } from "bun:test";
import { providers, buildCapabilityMatrix, PROVIDER_IDS } from "./registry";

test("registry exposes netease and qq adapters", () => {
  expect(providers.netease.id).toBe("netease");
  expect(providers.qq.id).toBe("qq");
  expect(PROVIDER_IDS).toEqual(["netease", "qq", "kugou"]);
});

test("capability matrix: netease and qq both online after A6 jsososo integration", () => {
  const m = buildCapabilityMatrix();
  expect(m.providers.length).toBe(3);
  const netease = m.providers.find(e => e.providerId === "netease");
  const qq = m.providers.find(e => e.providerId === "qq");
  const kugou = m.providers.find(e => e.providerId === "kugou");
  expect(kugou).toBeDefined();
  expect(kugou?.available).toBe(true);
  expect(kugou?.capabilities.length).toBeGreaterThan(0);
  expect(netease).toBeDefined();
  expect(netease?.available).toBe(true);
  expect(netease?.capabilities.length).toBeGreaterThan(0);
  expect(qq).toBeDefined();
  expect(qq?.available).toBe(true);
  expect(qq?.capabilities.length).toBeGreaterThan(0);
});