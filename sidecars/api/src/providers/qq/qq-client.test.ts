import { expect, test } from "bun:test";
import { clearRuntimeProviderCookie, setRuntimeProviderCookie } from "../../services/auth-session";
import {
  __setQqApiModuleForTest,
  getConfig,
  qqClient
} from "./qq-client";

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

test("getConfig returns empty object when MINERADIO_QQ_COOKIE unset", () => {
  withEnv("MINERADIO_QQ_COOKIE", undefined, () => {
    const cfg = getConfig();
    expect(cfg).toEqual({});
  });
});

test("getConfig returns {cookie} when MINERADIO_QQ_COOKIE set to non-empty string", () => {
  withEnv("MINERADIO_QQ_COOKIE", "uin=123; qqmusic_key=abc", () => {
    const cfg = getConfig();
    expect(cfg.cookie).toBe("uin=123; qqmusic_key=abc");
  });
});

test("getConfig returns empty object when MINERADIO_QQ_COOKIE is whitespace-only", () => {
  withEnv("MINERADIO_QQ_COOKIE", "   ", () => {
    const cfg = getConfig();
    expect(cfg).toEqual({});
  });
});

test("getConfig prefers runtime QQ cookie over env fallback", () => {
  withEnv("MINERADIO_QQ_COOKIE", "uin=123; qqmusic_key=env", () => {
    clearRuntimeProviderCookie("qq");
    expect(getConfig().cookie).toBe("uin=123; qqmusic_key=env");

    setRuntimeProviderCookie("qq", "uin=123; qqmusic_key=runtime");
    expect(getConfig().cookie).toBe("uin=123; qqmusic_key=runtime");

    clearRuntimeProviderCookie("qq");
  });
});

test("qq client resets SDK singleton cookie when runtime cookie is cleared", async () => {
  withEnv("MINERADIO_QQ_COOKIE", undefined, () => {
    clearRuntimeProviderCookie("qq");
  });
  const applied: Array<string | Record<string, string>> = [];
  __setQqApiModuleForTest({
    setCookie(cookie) {
      applied.push(cookie);
    },
    async api() {
      return "https://media.example.test/song.mp3";
    }
  });

  try {
    setRuntimeProviderCookie("qq", "uin=123; qqmusic_key=runtime");
    await qqClient.songUrl({ id: "songmid", type: "128" }, getConfig());

    clearRuntimeProviderCookie("qq");
    await qqClient.songUrl({ id: "songmid", type: "128" }, getConfig());
  } finally {
    __setQqApiModuleForTest(null);
    clearRuntimeProviderCookie("qq");
  }

  expect(applied).toEqual(["uin=123; qqmusic_key=runtime", ""]);
});

test("qq client loginStatus calls user/detail with supplied id", async () => {
  const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
  __setQqApiModuleForTest({
    setCookie() {},
    async api(path, query) {
      calls.push({ path, query });
      return { result: 100, data: { creator: { hostname: "QQ昵称" } } };
    }
  });

  try {
    await qqClient.loginStatus({ id: "123" }, { cookie: "uin=123; qqmusic_key=abc" });
  } finally {
    __setQqApiModuleForTest(null);
  }

  expect(calls).toEqual([
    {
      path: "user/detail",
      query: { id: "123" }
    }
  ]);
});

test("qq client vipInfo calls QQ musicu vip and base user batch", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ code: 0, getVipInfo: { code: 0 } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const out = await qqClient.vipInfo({ id: "123" }, { cookie: "uin=123; qqmusic_key=abc" });
    expect(out.body).toEqual({ code: 0, getVipInfo: { code: 0 } });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(calls.length).toBe(1);
  const url = new URL(calls[0].url);
  expect(url.origin + url.pathname).toBe("https://u.y.qq.com/cgi-bin/musicu.fcg");
  expect(url.searchParams.get("format")).toBe("json");
  const payload = JSON.parse(url.searchParams.get("data") ?? "{}");
  expect(payload.getVipInfo.module).toBe("userInfo.VipQueryServer");
  expect(payload.getVipInfo.method).toBe("SRFVipQuery_V2");
  expect(payload.getVipInfo.param.uin_list).toEqual(["123"]);
  expect(payload.getNickHead.module).toBe("userInfo.BaseUserInfoServer");
  expect(payload.getNickHead.method).toBe("get_user_baseinfo_v2");
  expect(payload.getNickHead.param.vec_uin).toEqual(["123"]);
  expect(payload.getVipIcon.module).toBe("music.lvz.VipIconUiShowSvr");
  expect(payload.getVipIcon.method).toBe("GetVipIconUiV2");
  expect(payload.getVipIcon.param).toEqual({ MusicID: "123", PID: 8 });
  expect((calls[0].init?.headers as Record<string, string>).Cookie).toBe("uin=123; qqmusic_key=abc");
});
