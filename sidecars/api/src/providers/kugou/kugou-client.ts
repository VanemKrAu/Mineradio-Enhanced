//! Kugou API client — wraps raw HTTP fetch calls to Kugou endpoints.
//!
//! Reference: Mineradio-Kugou-Modified/server.js + Mineradio-kugou-lite/server.js

import crypto from "crypto";

// ── Constants ───────────────────────────────────────────────────────────────

const KUGOU_ANDROID_SIGN_KEY = "LnT6xpN3khm36zse0QzvmgTZ3waWdRSA";
const KUGOU_LITE_SIGN_SALT = "185672dd44712f60bb1736df5a377e82";
const KUGOU_APPID = 3116;
const KUGOU_CLIENTVER = 11440;
const KUGOU_MID = "tls_mid_" + randomUUID().replace(/-/g, "").slice(0, 32);

const GATEWAY_BASE = "https://gateway.kugou.com";
const TRACKERCDN_BASE = "https://trackercdn.kugou.com";
const LYRICS_BASE = "https://lyrics.kugou.com";

// ── Types ───────────────────────────────────────────────────────────────────

export interface KugouCookie {
  userid?: string;
  token?: string;
  nickname?: string;
  avatar?: string;
  vipType?: string;
  mid?: string;
  dfid?: string;
  [key: string]: string | undefined;
}

export interface KugouQrKeyResult {
  key: string;
  qrcode: string;
  url: string;
  img: string;
}

export interface KugouQrCheckResult {
  status: number;
  loggedIn: boolean;
  cookie?: KugouCookie;
}

export interface KugouSearchResult {
  hash: string;
  albumAudioId: string;
  albumId: string;
  name: string;
  artist: string;
  artists: string[];
  album: string;
  cover: string;
  duration: number;
}

export interface KugouSongUrlResult {
  url: string;
  playable: boolean;
  level: string;
  quality: string;
  br: number;
}

export interface KugouLyricResult {
  lyric: string;
  tlyric?: string;
}

export interface KugouPlaylistSummary {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  creator: string;
  globalCollectionId?: string;
}

export interface KugouPlaylistTrack {
  hash: string;
  albumAudioId: string;
  albumId: string;
  name: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  qualityHashes: Record<string, string>;
  fileid: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function md5(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}

function randomUUID(): string {
  return crypto.randomUUID();
}

function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return sorted;
}

/** Android signature: md5(key + sortedParamsString + data + key) */
export function kugouAndroidSignature(
  params: Record<string, unknown>,
  data = ""
): string {
  const paramStr = Object.entries(sortObjectKeys(params))
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("");
  return md5(`${KUGOU_ANDROID_SIGN_KEY}${paramStr}${data}${KUGOU_ANDROID_SIGN_KEY}`);
}

/** Play-key signing: md5(hash.toLowerCase() + salt + appid + mid + userid) */
export function kugouSignKey(
  hash: string,
  mid: string,
  userid: string,
  appid = KUGOU_APPID
): string {
  return md5(`${hash.toLowerCase()}${KUGOU_LITE_SIGN_SALT}${appid}${mid}${userid || 0}`);
}

function randomDeviceId(): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  return `${hex()}${hex()}${hex()}${hex()}-${hex()}${hex()}-${hex()}${hex()}-${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`;
}

/** Kugou gateway API request with Android signature. */
export async function kugouApiRequest<T>(
  path: string,
  params: Record<string, unknown>,
  cookie?: KugouCookie,
  opts?: { encryptKey?: boolean }
): Promise<T> {
  const mid = cookie?.mid || KUGOU_MID;
  const userid = cookie?.userid || "0";
  const timestamp = Math.floor(Date.now() / 1000);

  const body: Record<string, unknown> = {
    appid: KUGOU_APPID,
    clientver: KUGOU_CLIENTVER,
    mid,
    userid,
    ...params,
  };

  const data = JSON.stringify(body);
  const signature = kugouAndroidSignature(
    { appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, mid, timestamp, userid },
    data
  );

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-router": "kgl-android.proxy.kugou.com",
    "x-request-from": "android",
    dfid: cookie?.dfid || "",
    mid,
    userid,
    timestamp: String(timestamp),
    signature,
  };

  if (opts?.encryptKey) {
    headers["x-encrypt-key"] = kugouSignKey(
      String(params.hash || ""),
      mid,
      userid
    );
  }

  const url = `${GATEWAY_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: data,
  });

  if (!res.ok) throw new Error(`Kugou API ${path}: ${res.status}`);
  const json = await res.json();
  return json as T;
}

/** Tracker CDN request for song URL (Modified-style). */
export async function kugouTrackercdnUrl(
  hash: string,
  cookie?: KugouCookie,
  quality?: string
): Promise<KugouSongUrlResult> {
  const mid = cookie?.mid || KUGOU_MID;
  const userid = cookie?.userid || "0";
  const token = cookie?.token || "";
  const vipType = parseInt(cookie?.vipType || "0", 10);
  const key = md5(`${hash}${KUGOU_ANDROID_SIGN_KEY}${KUGOU_APPID}${mid}${userid}`);

  const params = new URLSearchParams({
    cmd: "26",
    hash,
    key,
    pid: "2",
    behavior: "play",
    appid: String(KUGOU_APPID),
    mid,
    userid: String(userid),
    token,
    vipType: String(vipType),
  });
  if (quality) params.set("quality", quality);

  const res = await fetch(`${TRACKERCDN_BASE}/i/v2/?${params}`);
  if (!res.ok) throw new Error(`trackercdn: ${res.status}`);

  const json = await res.json();
  const data = json as Record<string, unknown>;

  return {
    url: String(data.url || ""),
    playable: !!data.url,
    level: String(data.level || ""),
    quality: String(data.quality || ""),
    br: Number(data.br || 0),
  };
}

/** Search songs via Kugou gateway. */
export async function kugouSearch(
  keyword: string,
  limit = 12,
  cookie?: KugouCookie
): Promise<KugouSearchResult[]> {
  const data = await kugouApiRequest<{ data?: { lists?: unknown[] } }>(
    "/v3/search/song",
    { keyword, pagesize: Math.min(limit, 20), page: 1 },
    cookie
  );

  const lists = (data?.data?.lists || []) as Record<string, unknown>[];
  return lists.map((item: Record<string, unknown>) => ({
    hash: String(item.EMixSongID || item.Hash || item["320hash"] || ""),
    albumAudioId: String(item.AlbumID || ""),
    albumId: String(item.AlbumID || ""),
    name: String(item.SongName || item.songname || ""),
    artist: String(item.ChoricSinger || item.singername || ""),
    artists: (String(item.ChoricSinger || "").split(/[,/、]/).filter(Boolean)),
    album: String(item.AlbumName || item.album_name || ""),
    cover: String(item.Img || item.cover || ""),
    duration: Number(item.Duration || item.duration || 0),
  }));
}

/** Get lyrics for a song. */
export async function kugouLyric(
  hash: string,
  duration = 0
): Promise<KugouLyricResult> {
  // Step 1: search for lyric ID
  const searchUrl = `${LYRICS_BASE}/search?ver=1&man=yes&client=pc&hash=${encodeURIComponent(hash)}&duration=${duration}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error(`lyric search: ${searchRes.status}`);

  const searchJson = await searchRes.json() as Record<string, unknown>;
  const candidates = (searchJson.candidates || []) as Record<string, unknown>[];
  if (candidates.length === 0) {
    return { lyric: "", tlyric: "" };
  }

  const best = candidates[0];
  const id = String(best.id || "");
  const accesskey = String(best.accesskey || "");

  // Step 2: download LRC
  const dlUrl = `${LYRICS_BASE}/download?ver=1&client=pc&id=${encodeURIComponent(id)}&accesskey=${encodeURIComponent(accesskey)}&fmt=lrc&charset=utf8`;
  const dlRes = await fetch(dlUrl);
  if (!dlRes.ok) throw new Error(`lyric download: ${dlRes.status}`);

  const dlJson = await dlRes.json() as Record<string, unknown>;
  return {
    lyric: String(dlJson.content || ""),
    tlyric: String((dlJson as Record<string, unknown>).tcontent || ""),
  };
}

/** Get Kugou login status from cookie. */
export function kugouLoginStatus(cookie: KugouCookie): {
  loggedIn: boolean;
  userId?: string;
  nickname?: string;
  avatarUrl?: string;
  vipType?: number;
} {
  const userId = cookie.userid || "";
  const token = cookie.token || "";
  const loggedIn = !!(userId && token);
  return {
    loggedIn,
    userId,
    nickname: cookie.nickname || "",
    avatarUrl: cookie.avatar || "",
    vipType: parseInt(cookie.vipType || "0", 10),
  };
}

/** Get user playlists. */
export async function kugouUserPlaylists(
  cookie: KugouCookie
): Promise<KugouPlaylistSummary[]> {
  const data = await kugouApiRequest<{ data?: { info?: unknown[] } }>(
    "/v7/get_all_list",
    {
      total_ver: "0",
      type: "0",
      page: 1,
      pagesize: 60,
      userid: cookie.userid || "0",
      token: cookie.token || "",
    },
    cookie
  );

  const info = (data?.data?.info || []) as Record<string, unknown>[];
  return info.map((item: Record<string, unknown>) => ({
    id: String(item.listid || item.specialid || ""),
    name: String(item.listname || item.name || ""),
    cover: String(item.imgurl || item.logo || ""),
    trackCount: Number(item.songcount || 0),
    creator: String(item.creator_name || item.nickname || ""),
    globalCollectionId: String(item.global_collection_id || ""),
  }));
}

/** Get playlist tracks. */
export async function kugouPlaylistTracks(
  playlistId: string,
  cookie: KugouCookie,
  limit = 500
): Promise<KugouPlaylistTrack[]> {
  const data = await kugouApiRequest<{ data?: { lists?: unknown[] } }>(
    "/v4/get_list_all_file",
    {
      listid: playlistId,
      page: 1,
      pagesize: limit,
      userid: cookie.userid || "0",
      token: cookie.token || "",
    },
    cookie
  );

  const lists = (data?.data?.lists || []) as Record<string, unknown>[];
  return lists.map((item: Record<string, unknown>) => {
    const hashes: Record<string, string> = {};
    for (const q of ["128hash", "320hash", "sqhash", "hrhash", "masterhash"]) {
      if (item[q]) hashes[q.replace("hash", "")] = String(item[q]);
    }

    return {
      hash: String(item.KlxMixSongID || item.Hash || item["320hash"] || ""),
      albumAudioId: String(item.AlbumID || ""),
      albumId: String(item.AlbumID || ""),
      name: String(item.SongName || ""),
      artist: String(item.SingerName || ""),
      album: String(item.AlbumName || ""),
      cover: String(item.Img || ""),
      duration: Number(item.Duration || 0),
      qualityHashes: hashes,
      fileid: String(item.FileID || ""),
    };
  });
}

/** Parse a raw Kugou cookie string into an object. */
export function parseKugouCookie(raw: string): KugouCookie {
  const obj: KugouCookie = {};
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k && v.length > 0) obj[k.trim()] = v.join("=").trim();
  }
  return obj;
}

/** Serialize a KugouCookie object into a cookie string. */
export function serializeKugouCookie(cookie: KugouCookie): string {
  return Object.entries(cookie)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
