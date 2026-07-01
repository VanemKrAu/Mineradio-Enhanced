import { expect, test } from "bun:test";
import {
  ProviderLoginQrCheckSchema,
  ProviderLoginQrImageSchema,
  ProviderLoginQrKeySchema,
  ProviderLoginStatusSchema,
  ProviderLogoutAckSchema,
  ProviderSessionCookieAckSchema,
} from "./session";

test("ProviderSessionCookieAckSchema accepts provider + stored ack without cookie", () => {
  const parsed = ProviderSessionCookieAckSchema.parse({
    provider: "netease",
    stored: true,
  });

  expect(parsed.provider).toBe("netease");
  expect(parsed.stored).toBe(true);
  expect(JSON.stringify(parsed)).not.toContain("MUSIC_U");
  expect(JSON.stringify(parsed)).not.toContain("cookie");
});

test("ProviderSessionCookieAckSchema rejects cookie-bearing responses", () => {
  const parsed = ProviderSessionCookieAckSchema.safeParse({
    provider: "qq",
    stored: true,
    cookie: "uin=123; qqmusic_key=secret",
  });

  expect(parsed.success).toBe(false);
});

test("ProviderLoginStatusSchema accepts profile summaries without cookie", () => {
  const parsed = ProviderLoginStatusSchema.parse({
    provider: "netease",
    loggedIn: true,
    nickname: "tester",
    userId: "42",
  });

  expect(parsed.loggedIn).toBe(true);
  expect(JSON.stringify(parsed)).not.toContain("MUSIC_U");
  expect(JSON.stringify(parsed)).not.toContain("cookie");
});

test("ProviderLoginStatusSchema accepts Netease VIP profile metadata without auth material", () => {
  const parsed = ProviderLoginStatusSchema.parse({
    provider: "netease",
    loggedIn: true,
    nickname: "tester",
    userId: "42",
    vipType: 11,
    vipLevel: "svip",
    isVip: true,
    isSvip: true,
    vipLabel: "黑胶SVIP·陆",
    vipIcon: "netease-svip",
    vipIconUrl: "https://example.com/vip.png",
    vipTier: 6,
    vipLevelName: "陆",
  });

  expect(parsed.vipType).toBe(11);
  expect(parsed.vipLevel).toBe("svip");
  expect(parsed.isVip).toBe(true);
  expect(parsed.isSvip).toBe(true);
  expect(parsed.vipLabel).toBe("黑胶SVIP·陆");
  expect(parsed.vipIcon).toBe("netease-svip");
  expect(parsed.vipIconUrl).toBe("https://example.com/vip.png");
  expect(parsed.vipTier).toBe(6);
  expect(parsed.vipLevelName).toBe("陆");
  expect(JSON.stringify(parsed)).not.toContain("MUSIC_U");
  expect(JSON.stringify(parsed)).not.toContain("cookie");
});

test("ProviderLoginStatusSchema still rejects cookie-bearing profile responses", () => {
  const parsed = ProviderLoginStatusSchema.safeParse({
    provider: "netease",
    loggedIn: true,
    userId: "42",
    cookie: "MUSIC_U=secret",
  });

  expect(parsed.success).toBe(false);
});

test("ProviderLoginQr schemas accept QQ QR responses without cookie material", () => {
  const key = ProviderLoginQrKeySchema.parse({
    provider: "qq",
    key: "qrsig%3Dabc|123456",
  });
  const image = ProviderLoginQrImageSchema.parse({
    provider: "qq",
    key: key.key,
    img: "data:image/png;base64,abc",
  });
  const checked = ProviderLoginQrCheckSchema.parse({
    provider: "qq",
    key: key.key,
    code: 66,
    message: "未扫描二维码",
    loggedIn: false,
  });

  expect(key.provider).toBe("qq");
  expect(image.provider).toBe("qq");
  expect(checked.provider).toBe("qq");
  expect(JSON.stringify({ key, image, checked })).not.toContain("qqmusic_key");
  expect(JSON.stringify({ key, image, checked })).not.toContain("cookie");
});

test("ProviderLogoutAckSchema accepts logout ack without auth material", () => {
  const parsed = ProviderLogoutAckSchema.parse({
    provider: "netease",
    loggedOut: true,
  });

  expect(parsed.loggedOut).toBe(true);
  expect(JSON.stringify(parsed)).not.toContain("cookie");
});
