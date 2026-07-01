import { expect, test } from "bun:test";
import { clearRuntimeProviderCookie, setRuntimeProviderCookie } from "../../services/auth-session";
import {
  __setNcmApiModuleForTest,
  getConfig,
  hanaClient
} from "./hana-client";

function withEnv(key: string, value: string | undefined, run: () => void): void {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    run();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

test("getConfig prefers runtime Netease cookie over env fallback", () => {
  withEnv("MINERADIO_NETEASE_COOKIE", "MUSIC_U=env", () => {
    clearRuntimeProviderCookie("netease");
    expect(getConfig().cookie).toBe("MUSIC_U=env");

    setRuntimeProviderCookie("netease", "MUSIC_U=runtime");
    expect(getConfig().cookie).toBe("MUSIC_U=runtime");

    clearRuntimeProviderCookie("netease");
  });
});

test("vipInfo combines Netease vip_info_v2 and vip_info bodies when both are available", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  __setNcmApiModuleForTest({
    vip_info_v2: async (params) => {
      calls.push({ name: "v2", params });
      return { body: { data: { vipLabel: "黑胶SVIP" } } };
    },
    vip_info: async (params) => {
      calls.push({ name: "legacy", params });
      return { body: { data: { redVipLevelIcon: "//p5.music.126.net/vip.png" } } };
    }
  });

  try {
    const out = await hanaClient.vipInfo({ uid: "42" }, { cookie: "MUSIC_U=demo" });
    expect(out.body).toEqual({
      vipInfoV2: { data: { vipLabel: "黑胶SVIP" } },
      vipInfo: { data: { redVipLevelIcon: "//p5.music.126.net/vip.png" } }
    });
  } finally {
    __setNcmApiModuleForTest(null);
  }

  expect(calls).toEqual([
    { name: "v2", params: { uid: "42", cookie: "MUSIC_U=demo" } },
    { name: "legacy", params: { uid: "42", cookie: "MUSIC_U=demo" } }
  ]);
});
