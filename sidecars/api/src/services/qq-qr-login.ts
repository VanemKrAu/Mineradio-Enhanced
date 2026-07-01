import {
  ProviderLoginQrCheckSchema,
  ProviderLoginQrImageSchema,
  ProviderLoginQrKeySchema,
  type ProviderLoginQrCheck,
  type ProviderLoginQrImage,
  type ProviderLoginQrKey,
} from "@mineradio/shared";
import { setRuntimeProviderCookie } from "./auth-session";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type CookieMap = Map<string, string>;

type QqPtuiResult = {
  code: number;
  redirectUrl?: string;
  message?: string;
};

export type QqQrLoginService = {
  createKey(): Promise<ProviderLoginQrKey>;
  createImage(key: string): Promise<ProviderLoginQrImage>;
  check(key: string): Promise<ProviderLoginQrCheck>;
};

export type QqQrLoginDeps = {
  fetch?: FetchLike;
  now?: () => number;
  guid?: () => string;
  timeoutMs?: number;
};

const QQ_QR_SHOW_URL =
  "https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=0.9698127522807933&daid=383&pt_3rd_aid=100497308&u1=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump";
const QQ_AUTHORIZE_URL = "https://graph.qq.com/oauth2.0/authorize";
const QQ_MUSICU_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_REDIRECT_URI = "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/";

function hash33(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash += (hash << 5) + value.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function gtkFromPskey(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash += (hash << 5) + value.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function defaultGuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (part) => {
    const value = Math.floor(Math.random() * 16);
    return (part === "x" ? value : (value & 3) | 8).toString(16);
  }).toUpperCase();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function readSetCookie(response: Response): string | null {
  return response.headers.get("set-cookie");
}

function parseSetCookie(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(/,(?=\s*[^=;,]+=)/)
    .map((part) => part.split(";")[0]?.trim() ?? "")
    .filter((part) => part.includes("=") && part.split("=")[1]);
}

function mergeCookies(cookies: CookieMap, header: string | null): void {
  for (const cookie of parseSetCookie(header)) {
    const [name] = cookie.split("=");
    if (name) cookies.set(name, cookie);
  }
}

function cookieValue(cookies: CookieMap, name: string): string {
  const pair = cookies.get(name);
  if (!pair) return "";
  return pair.slice(name.length + 1);
}

function cookieHeader(cookies: CookieMap): string {
  return Array.from(cookies.values()).join("; ");
}

function encodeKey(qrsig: string, ptqrtoken: number): string {
  return `${encodeURIComponent(qrsig)}|${ptqrtoken}`;
}

function decodeKey(key: string): { qrsig: string; ptqrtoken: string } | null {
  const [encodedQrsig, ptqrtoken] = key.split("|");
  if (!encodedQrsig || !ptqrtoken) return null;
  try {
    return { qrsig: decodeURIComponent(encodedQrsig), ptqrtoken };
  } catch {
    return null;
  }
}

function parsePtuiCallback(text: string): QqPtuiResult {
  const values = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? "");
  const parsedCode = Number(values[0] ?? NaN);
  return {
    code: Number.isFinite(parsedCode) ? parsedCode : -1,
    redirectUrl: values[2],
    message: values[4],
  };
}

function normalizePollMessage(result: QqPtuiResult, text: string): string {
  if (result.code === 0 || text.includes("登录成功")) return "登录成功";
  if (result.code === 65 || text.includes("已失效")) return "二维码已过期";
  if (result.code === 67 || text.includes("认证中") || text.includes("已扫描")) return "已扫码，请在手机上确认登录";
  return "未扫描二维码";
}

function buildAuthorizeForm(gtk: number, guid: string): FormData {
  const data = new FormData();
  data.append("response_type", "code");
  data.append("client_id", "100497308");
  data.append("redirect_uri", QQ_REDIRECT_URI);
  data.append("scope", "get_user_info,get_app_friends");
  data.append("state", "state");
  data.append("switch", "");
  data.append("from_ptlogin", "1");
  data.append("src", "1");
  data.append("update_auth", "1");
  data.append("openapi", "1010_1030");
  data.append("g_tk", String(gtk));
  data.append("auth_time", new Date().toString());
  data.append("ui", guid);
  return data;
}

function buildMusicuBody(gtk: number, code: string): string {
  return JSON.stringify({
    comm: {
      g_tk: gtk,
      platform: "yqq",
      ct: 24,
      cv: 0,
    },
    req: {
      module: "QQConnectLogin.LoginServer",
      method: "QQLogin",
      param: { code },
    },
  });
}

function checkUrl(now: number, ptqrtoken: string): string {
  const params = new URLSearchParams({
    u1: "https://graph.qq.com/oauth2.0/login_jump",
    ptqrtoken,
    ptredirect: "0",
    h: "1",
    t: "1",
    g: "1",
    from_ui: "1",
    ptlang: "2052",
    action: `0-0-${now}`,
    js_ver: "23111510",
    js_type: "1",
    login_sig: "du-YS1h8*0GqVqcrru0pXkpwVg2DYw-DtbFulJ62IgPf6vfiJe*4ONVrYc5hMUNE",
    pt_uistyle: "40",
    aid: "716027609",
    daid: "383",
    pt_3rd_aid: "100497308",
    o1vId: "3674fc47871e9c407d8838690b355408",
    pt_js_version: "v1.48.1",
  });
  return `https://ssl.ptlogin2.qq.com/ptqrlogin?${params.toString()}`;
}

export function createQqQrLoginService(deps: QqQrLoginDeps = {}): QqQrLoginService {
  const fetcher = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const guid = deps.guid ?? defaultGuid;
  const timeoutMs = deps.timeoutMs ?? 10000;
  const imageCache = new Map<string, string>();

  async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async createKey() {
      const resp = await fetchWithTimeout(QQ_QR_SHOW_URL);
      const qrsig = readSetCookie(resp)?.match(/qrsig=([^;]+)/)?.[1] ?? "";
      if (!qrsig) throw new Error("QQ_QR_SIG_MISSING");
      const img = `data:image/png;base64,${arrayBufferToBase64(await resp.arrayBuffer())}`;
      const key = encodeKey(qrsig, hash33(qrsig));
      imageCache.set(key, img);
      return ProviderLoginQrKeySchema.parse({ provider: "qq", key });
    },

    async createImage(key: string) {
      const normalizedKey = key.trim();
      if (!decodeKey(normalizedKey)) throw new Error("QQ_QR_KEY_REQUIRED");
      const img = imageCache.get(normalizedKey);
      if (!img) throw new Error("QQ_QR_IMAGE_MISSING");
      return ProviderLoginQrImageSchema.parse({
        provider: "qq",
        key: normalizedKey,
        img,
      });
    },

    async check(key: string) {
      const normalizedKey = key.trim();
      const decoded = decodeKey(normalizedKey);
      if (!decoded) throw new Error("QQ_QR_KEY_REQUIRED");
      const cookies: CookieMap = new Map();
      const checkResp = await fetchWithTimeout(checkUrl(now(), decoded.ptqrtoken), {
        headers: { Cookie: `qrsig=${decoded.qrsig}` },
      });
      mergeCookies(cookies, readSetCookie(checkResp));
      const text = await checkResp.text();
      const ptui = parsePtuiCallback(text);
      const message = normalizePollMessage(ptui, text);
      if (ptui.code !== 0 && !text.includes("登录成功")) {
        const expired = ptui.code === 65 || message === "二维码已过期";
        if (expired) imageCache.delete(normalizedKey);
        return ProviderLoginQrCheckSchema.parse({
          provider: "qq",
          key: normalizedKey,
          code: ptui.code,
          message,
          loggedIn: false,
          scanned: ptui.code === 67 || message.startsWith("已扫码"),
          expired,
          stored: false,
        });
      }

      if (!ptui.redirectUrl) throw new Error("QQ_QR_REDIRECT_MISSING");
      const checkSigResp = await fetchWithTimeout(ptui.redirectUrl, {
        redirect: "manual",
        headers: { Cookie: cookieHeader(cookies) },
      });
      mergeCookies(cookies, readSetCookie(checkSigResp));
      const pSkey = cookieValue(cookies, "p_skey");
      if (!pSkey) throw new Error("QQ_QR_PSKEY_MISSING");
      const gtk = gtkFromPskey(pSkey);
      const authorizeResp = await fetchWithTimeout(QQ_AUTHORIZE_URL, {
        redirect: "manual",
        method: "POST",
        body: buildAuthorizeForm(gtk, guid()),
        headers: { Cookie: cookieHeader(cookies) },
      });
      mergeCookies(cookies, readSetCookie(authorizeResp));
      const location = authorizeResp.headers.get("location") ?? "";
      const code = location.match(/[?&]code=([^&]+)/)?.[1] ?? "";
      if (authorizeResp.status < 300 || authorizeResp.status >= 400 || !code) {
        throw new Error("QQ_QR_AUTHORIZE_FAILED");
      }
      const musicuResp = await fetchWithTimeout(QQ_MUSICU_URL, {
        method: "POST",
        body: buildMusicuBody(gtk, code),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieHeader(cookies),
        },
      });
      mergeCookies(cookies, readSetCookie(musicuResp));
      const cookie = cookieHeader(cookies);
      if (!cookie) throw new Error("QQ_QR_COOKIE_MISSING");
      setRuntimeProviderCookie("qq", cookie);
      imageCache.delete(normalizedKey);
      return ProviderLoginQrCheckSchema.parse({
        provider: "qq",
        key: normalizedKey,
        code: 0,
        message: "登录成功",
        loggedIn: true,
        scanned: true,
        expired: false,
        stored: true,
      });
    },
  };
}

export const qqQrLogin = createQqQrLoginService();
