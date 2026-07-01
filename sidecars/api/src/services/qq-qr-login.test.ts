import { afterEach, expect, test } from "bun:test";
import { ProviderLoginQrCheckSchema, ProviderLoginQrImageSchema, ProviderLoginQrKeySchema } from "@mineradio/shared";
import { clearRuntimeProviderCookie, getProviderCookie } from "./auth-session";
import { createQqQrLoginService } from "./qq-qr-login";

afterEach(() => {
  clearRuntimeProviderCookie("qq");
});

function binaryResponse(bytes: number[], setCookie: string): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "set-cookie": setCookie },
  });
}

function textResponse(text: string, init: ResponseInit = {}): Response {
  return new Response(text, init);
}

test("QQ QR service creates an opaque key and returns cached QR image", async () => {
  const service = createQqQrLoginService({
    fetch: async (input) => {
      expect(String(input)).toContain("ptqrshow");
      return binaryResponse([1, 2, 3], "qrsig=qr_sig_1; Path=/; HttpOnly");
    },
  });

  const key = await service.createKey();
  const image = await service.createImage(key.key);

  expect(ProviderLoginQrKeySchema.parse(key)).toEqual({
    provider: "qq",
    key: "qr_sig_1|1987342677",
  });
  expect(ProviderLoginQrImageSchema.parse(image)).toEqual({
    provider: "qq",
    key: "qr_sig_1|1987342677",
    img: "data:image/png;base64,AQID",
  });
});

test("QQ QR service maps waiting poll responses without storing a cookie", async () => {
  const calls: string[] = [];
  const service = createQqQrLoginService({
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("ptqrshow")) {
        return binaryResponse([4, 5, 6], "qrsig=qr_wait; Path=/");
      }
      expect(url).toContain("ptqrlogin");
      return textResponse("ptuiCB('66','0','','0','二维码未失效。','');");
    },
  });

  const key = await service.createKey();
  const result = await service.check(key.key);

  expect(calls.length).toBe(2);
  expect(ProviderLoginQrCheckSchema.parse(result)).toEqual({
    provider: "qq",
    key: key.key,
    code: 66,
    message: "未扫描二维码",
    loggedIn: false,
    scanned: false,
    expired: false,
    stored: false,
  });
  expect(getProviderCookie("qq")).toBe(undefined);
});

test("QQ QR service follows the success redirect chain and persists the final cookie", async () => {
  const calls: string[] = [];
  const service = createQqQrLoginService({
    fetch: async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("ptqrshow")) {
        return binaryResponse([7, 8, 9], "qrsig=qr_success; Path=/");
      }
      if (url.includes("ptqrlogin")) {
        const headers = init?.headers as Record<string, string> | undefined;
        expect(headers?.Cookie).toBe("qrsig=qr_success");
        return textResponse("ptuiCB('0','0','https://ssl.ptlogin2.qq.com/check_sig?pttype=1','0','登录成功！','tester');", {
          headers: { "set-cookie": "uin=o00123; Path=/, skey=@login; Path=/" },
        });
      }
      if (url.includes("check_sig")) {
        return textResponse("", {
          status: 302,
          headers: { "set-cookie": "p_skey=pskey; Path=/; Domain=.qq.com" },
        });
      }
      if (url.includes("graph.qq.com/oauth2.0/authorize")) {
        return textResponse("", {
          status: 302,
          headers: {
            location: "https://y.qq.com/portal/wx_redirect.html?code=qq-code-1",
            "set-cookie": "graph_cookie=graph; Path=/",
          },
        });
      }
      if (url.includes("u.y.qq.com/cgi-bin/musicu.fcg")) {
        return textResponse("{}", {
          headers: { "set-cookie": "qqmusic_key=music_key; Path=/, qm_keyst=qm_key; Path=/" },
        });
      }
      throw new Error(`unexpected url: ${url}`);
    },
    guid: () => "00000000-0000-4000-8000-000000000000",
  });

  const key = await service.createKey();
  const result = await service.check(key.key);

  expect(calls.length).toBe(5);
  expect(result).toMatchObject({
    provider: "qq",
    key: key.key,
    code: 0,
    message: "登录成功",
    loggedIn: true,
    scanned: true,
    stored: true,
  });
  const stored = getProviderCookie("qq") ?? "";
  expect(stored).toContain("uin=o00123");
  expect(stored).toContain("p_skey=pskey");
  expect(stored).toContain("qqmusic_key=music_key");
  expect(JSON.stringify(result)).not.toContain("qqmusic_key");
});
