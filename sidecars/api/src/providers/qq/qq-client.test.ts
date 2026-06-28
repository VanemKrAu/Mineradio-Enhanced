import { expect, test } from "bun:test";
import { getConfig } from "./qq-client";

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