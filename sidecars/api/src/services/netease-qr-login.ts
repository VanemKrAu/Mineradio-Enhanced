import {
  ProviderLoginQrCheckSchema,
  ProviderLoginQrImageSchema,
  ProviderLoginQrKeySchema,
  type ProviderLoginQrCheck,
  type ProviderLoginQrImage,
  type ProviderLoginQrKey,
} from "@mineradio/shared";
import {
  login_qr_check,
  login_qr_create,
  login_qr_key,
} from "NeteaseCloudMusicApi";
import { setRuntimeProviderCookie } from "./auth-session";

type NeteaseApiResponse = {
  body?: unknown;
  cookie?: unknown;
};

type NeteaseApiCall = (query: Record<string, unknown>) => Promise<NeteaseApiResponse>;

export type NeteaseQrLoginService = {
  createKey(): Promise<ProviderLoginQrKey>;
  createImage(key: string): Promise<ProviderLoginQrImage>;
  check(key: string): Promise<ProviderLoginQrCheck>;
};

export type NeteaseQrLoginDeps = {
  qrKey: NeteaseApiCall;
  qrCreate: NeteaseApiCall;
  qrCheck: NeteaseApiCall;
  now?: () => number;
};

function asObj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function responseBody(resp: NeteaseApiResponse): Record<string, unknown> {
  return asObj(resp.body) ?? {};
}

function responseData(resp: NeteaseApiResponse): Record<string, unknown> {
  return asObj(responseBody(resp).data) ?? {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readQrCookie(resp: NeteaseApiResponse): string | undefined {
  const body = responseBody(resp);
  const data = responseData(resp);
  return (
    readString(resp.cookie) ??
    readString(body.cookie) ??
    readString(data.cookie) ??
    readString(data.cookies)
  );
}

function readQrCode(resp: NeteaseApiResponse): number {
  const body = responseBody(resp);
  const data = responseData(resp);
  return readNumber(body.code) ?? readNumber(data.code) ?? 0;
}

function readQrMessage(resp: NeteaseApiResponse): string | undefined {
  const body = responseBody(resp);
  const data = responseData(resp);
  return readString(body.message) ?? readString(data.message);
}

export function createNeteaseQrLoginService(deps: NeteaseQrLoginDeps): NeteaseQrLoginService {
  const now = deps.now ?? Date.now;
  return {
    async createKey() {
      const resp = await deps.qrKey({ timestamp: now() });
      const key = readString(responseData(resp).unikey);
      if (!key) throw new Error("NETEASE_QR_KEY_MISSING");
      return ProviderLoginQrKeySchema.parse({ provider: "netease", key });
    },

    async createImage(key: string) {
      const normalizedKey = key.trim();
      if (!normalizedKey) throw new Error("NETEASE_QR_KEY_REQUIRED");
      const resp = await deps.qrCreate({ key: normalizedKey, qrimg: true, timestamp: now() });
      const data = responseData(resp);
      const img = readString(data.qrimg);
      if (!img) throw new Error("NETEASE_QR_IMAGE_MISSING");
      return ProviderLoginQrImageSchema.parse({
        provider: "netease",
        key: normalizedKey,
        img,
        url: readString(data.qrurl),
      });
    },

    async check(key: string) {
      const normalizedKey = key.trim();
      if (!normalizedKey) throw new Error("NETEASE_QR_KEY_REQUIRED");
      let resp = await deps.qrCheck({ key: normalizedKey, noCookie: true, timestamp: now() });
      let cookie = readQrCookie(resp);
      const code = readQrCode(resp);
      if (code === 803 && !cookie) {
        resp = await deps.qrCheck({ key: normalizedKey, timestamp: now() });
        cookie = readQrCookie(resp);
      }
      const stored = code === 803 && !!cookie;
      if (stored && cookie) setRuntimeProviderCookie("netease", cookie);
      return ProviderLoginQrCheckSchema.parse({
        provider: "netease",
        key: normalizedKey,
        code,
        message: readQrMessage(resp),
        loggedIn: stored,
        scanned: code === 802,
        expired: code === 800,
        stored,
      });
    },
  };
}

export const neteaseQrLogin = createNeteaseQrLoginService({
  qrKey: login_qr_key as unknown as NeteaseApiCall,
  qrCreate: login_qr_create as unknown as NeteaseApiCall,
  qrCheck: login_qr_check as unknown as NeteaseApiCall,
});
