import {
  cloudsearch,
  songDetail,
  songUrl,
  songUrlV1,
  lyric,
  lyricNew,
  playlistDetail,
  playlistCatlist,
  userPlaylist,
  loginStatus,
  logout,
  like,
  songLikeCheck,
  likelist,
  playlistTracks,
  playlistTrackAdd
} from "hana-music-api";
import { getProviderCookie } from "../../services/auth-session";

export interface NeteaseConfig {
  cookie?: string;
}

export function getConfig(): NeteaseConfig {
  const cookie = getProviderCookie("netease");
  if (cookie) return { cookie };
  return {};
}

type NeteaseCloudMusicApiModule = {
  vip_info?: (params: Record<string, unknown>) => Promise<{ body: unknown }>;
  vip_info_v2?: (params: Record<string, unknown>) => Promise<{ body: unknown }>;
};

type NeteaseVipInfoCall = {
  key: "vipInfoV2" | "vipInfo";
  fn: NonNullable<NeteaseCloudMusicApiModule["vip_info"]>;
};

let cachedNcmApiModule: NeteaseCloudMusicApiModule | null = null;

function getNcmApi(): NeteaseCloudMusicApiModule {
  if (cachedNcmApiModule === null) {
    const meta = import.meta as { require?: (id: string) => NeteaseCloudMusicApiModule };
    if (typeof meta.require !== "function") {
      throw new Error("NeteaseCloudMusicApi require not available in this runtime");
    }
    cachedNcmApiModule = meta.require("NeteaseCloudMusicApi");
  }
  return cachedNcmApiModule;
}

export function __setNcmApiModuleForTest(module: NeteaseCloudMusicApiModule | null): void {
  cachedNcmApiModule = module;
}

async function neteaseVipInfo(
  query: Record<string, unknown>,
  config?: { cookie?: string }
): Promise<{ body: unknown }> {
  const api = getNcmApi();
  const fns: NeteaseVipInfoCall[] = [];
  if (api.vip_info_v2) fns.push({ key: "vipInfoV2", fn: api.vip_info_v2 });
  if (api.vip_info) fns.push({ key: "vipInfo", fn: api.vip_info });
  if (fns.length === 0) return { body: {} };
  const uid = String(query.uid ?? query.userId ?? "").trim();
  const params = {
    uid,
    cookie: config?.cookie ?? ""
  };
  if (fns.length === 1) {
    const resp = await fns[0].fn(params);
    return { body: resp.body };
  }
  const settled = await Promise.allSettled(
    fns.map(async ({ key, fn }) => [key, (await fn(params)).body] as const)
  );
  const body: Record<string, unknown> = {};
  for (const result of settled) {
    if (result.status === "fulfilled") body[result.value[0]] = result.value[1];
  }
  return { body };
}

export const hanaClient = {
  cloudsearch,
  songDetail,
  songUrl,
  songUrlV1,
  lyric,
  lyricNew,
  playlistDetail,
  playlistCatlist,
  userPlaylist,
  loginStatus,
  logout,
  like,
  songLikeCheck,
  likelist,
  playlistTracks,
  playlistTrackAdd,
  vipInfo: neteaseVipInfo
} as const;
