import type {
  PodcastBeatmapResponse,
  PodcastCollection,
  PodcastDetailResponse,
  PodcastHotResponse,
  PodcastMyItemsResponse,
  PodcastMyResponse,
  PodcastProgram,
  PodcastProgramsResponse,
  PodcastRadio,
  PodcastSearchResponse
} from "@mineradio/shared";
import {
  PodcastBeatmapResponseSchema,
  PodcastDetailResponseSchema,
  PodcastHotResponseSchema,
  PodcastMyItemsResponseSchema,
  PodcastMyResponseSchema,
  PodcastProgramsResponseSchema,
  PodcastRadioSchema,
  PodcastSearchResponseSchema
} from "@mineradio/shared";
import { getProviderCookie } from "./auth-session";

type NeteaseResponse = { body?: Record<string, unknown> } & Record<string, unknown>;
type PodcastRequester = {
  cloudsearch?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
  djHot?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
  djDetail?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
  djProgram?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
  djSublist?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
  userAudio?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
  djPaygift?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
  recordRecentVoice?: (params: Record<string, unknown>) => Promise<NeteaseResponse>;
};

export type PodcastLoginInfo = {
  loggedIn: boolean;
  userId?: string | number;
};

export type PodcastServiceDeps = {
  requester?: PodcastRequester;
  loginStatus?: () => Promise<PodcastLoginInfo>;
  beatmapAnalyzer?: (url: string, opts: { durationSec: number; introSec?: number; userAgent: string }) => Promise<Record<string, unknown>>;
  now?: () => number;
};

export type PodcastService = {
  search(params: { keywords: string; limit: number }): Promise<PodcastSearchResponse>;
  hot(params: { limit: number; offset: number }): Promise<PodcastHotResponse>;
  detail(params: { rid: string }): Promise<PodcastDetailResponse>;
  programs(params: { rid: string; limit: number; offset: number }): Promise<PodcastProgramsResponse>;
  my(): Promise<PodcastMyResponse>;
  myItems(params: { key: string; limit: number; offset: number }): Promise<PodcastMyItemsResponse>;
  djBeatmap(params: { url: string; durationSec: number; introSec?: number }): Promise<PodcastBeatmapResponse>;
};

const PODCAST_SEARCH_TYPE = 1009;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function createPodcastService(deps: PodcastServiceDeps = {}): PodcastService {
  const requester = deps.requester ?? defaultPodcastRequester();
  const loginStatus = deps.loginStatus ?? defaultLoginStatus;
  const beatmapAnalyzer = deps.beatmapAnalyzer ?? defaultBeatmapAnalyzer;

  return {
    async search(params) {
      const keywords = String(params.keywords || "").trim();
      if (!keywords) return { podcasts: [], total: 0 };
      const limit = clampInt(params.limit, 6, 30, 18);
      const resp = await callRequester(requester.cloudsearch, { keywords, type: PODCAST_SEARCH_TYPE, limit });
      const result = bodyOf(resp).result as Record<string, unknown> | undefined;
      const raw = firstArrayFrom(result, ["djRadios", "djradios", "radios"]);
      return PodcastSearchResponseSchema.parse({
        podcasts: raw.map(mapPodcastRadio).filter(item => item.id),
        total: Number(result?.djRadiosCount ?? result?.djradiosCount ?? raw.length) || 0
      });
    },

    async hot(params) {
      const limit = clampInt(params.limit, 6, 30, 18);
      const offset = clampInt(params.offset, 0, Number.MAX_SAFE_INTEGER, 0);
      const resp = await callRequester(requester.djHot, { limit, offset, ...authParams() });
      const body = bodyOf(resp);
      const raw = firstArrayFrom(body, ["djRadios", "djradios", "radios", "data"]);
      return PodcastHotResponseSchema.parse({
        podcasts: raw.map(mapPodcastRadio).filter(item => item.id),
        more: !!body.hasMore
      });
    },

    async detail(params) {
      const rid = String(params.rid || "").trim();
      if (!rid) throw new Error("Missing podcast id");
      const resp = await callRequester(requester.djDetail, { rid, ...authParams() });
      const body = bodyOf(resp);
      return PodcastDetailResponseSchema.parse({
        podcast: mapPodcastRadio(body.data || body.djRadio || body.radio || body)
      });
    },

    async programs(params) {
      const rid = String(params.rid || "").trim();
      if (!rid) throw new Error("Missing podcast id");
      const limit = clampInt(params.limit, 10, 60, 30);
      const offset = clampInt(params.offset, 0, Number.MAX_SAFE_INTEGER, 0);
      const resp = await callRequester(requester.djProgram, { rid, limit, offset, asc: false, ...authParams() });
      const body = bodyOf(resp);
      const raw = firstArrayFrom(body, ["programs"]);
      const data = body.data as Record<string, unknown> | undefined;
      const dataRaw = raw.length ? raw : firstArrayFrom(data, ["list", "programs"]);
      const radio = dataRaw[0] && typeof dataRaw[0] === "object" && "radio" in dataRaw[0]
        ? mapPodcastRadio((dataRaw[0] as Record<string, unknown>).radio)
        : ({ id: rid, rid, name: "" } as Partial<PodcastRadio>);
      return PodcastProgramsResponseSchema.parse({
        radio,
        programs: dataRaw.map((item) => mapPodcastProgram(item, radio)).filter(item => item.id && item.title),
        more: !!body.more,
        total: Number(body.count ?? dataRaw.length) || 0
      });
    },

    async my() {
      const info = await loginStatus();
      const keys = ["collect", "created", "liked"];
      if (!info.loggedIn || !info.userId) {
        return PodcastMyResponseSchema.parse({
          loggedIn: false,
          collections: keys.map(key => podcastCollectionMeta(key, []))
        });
      }
      const collections = await Promise.all(keys.map(async key => {
        try {
          const data = await fetchMyPodcastItems(requester, key, info, 12, 0);
          return podcastCollectionMeta(key, data.items);
        } catch {
          return podcastCollectionMeta(key, []);
        }
      }));
      return PodcastMyResponseSchema.parse({ loggedIn: true, collections });
    },

    async myItems(params) {
      const info = await loginStatus();
      if (!info.loggedIn || !info.userId) {
        return PodcastMyItemsResponseSchema.parse({
          loggedIn: false,
          ...podcastCollectionMeta(params.key || "collect", []),
          items: []
        });
      }
      const data = await fetchMyPodcastItems(
        requester,
        params.key || "collect",
        info,
        clampInt(params.limit, 8, 60, 36),
        clampInt(params.offset, 0, Number.MAX_SAFE_INTEGER, 0)
      );
      return PodcastMyItemsResponseSchema.parse({
        loggedIn: true,
        ...podcastCollectionMeta(params.key || "collect", data.items),
        itemType: data.itemType,
        items: data.items
      });
    },

    async djBeatmap(params) {
      if (!/^https?:\/\//i.test(params.url || "")) throw new Error("Invalid audio url");
      const map = await beatmapAnalyzer(params.url, {
        durationSec: Math.max(0, Number(params.durationSec) || 0),
        introSec: Math.max(0, Number(params.introSec) || 0),
        userAgent: UA
      });
      return PodcastBeatmapResponseSchema.parse({ ok: true, map });
    }
  };
}

export function mapPodcastRadio(raw: unknown): PodcastRadio {
  const r = record(raw);
  const dj = record(r.dj || r.djSimple || r.djUser || r.creator);
  const id = stringId(r.id ?? r.rid ?? r.radioId);
  return PodcastRadioSchema.parse({
    id,
    rid: id,
    name: stringValue(r.name ?? r.radioName),
    coverUrl: stringValue(r.picUrl ?? r.picURL ?? r.coverUrl ?? r.coverImgUrl ?? r.avatarUrl),
    description: stringValue(r.desc ?? r.description ?? r.rcmdText),
    djName: stringValue(dj.nickname ?? r.djName ?? r.nickname),
    category: stringValue(r.category ?? r.categoryName),
    programCount: Number(r.programCount ?? r.programNum ?? r.programCnt ?? 0) || 0,
    subCount: Number(r.subCount ?? r.subedCount ?? r.subscriberCount ?? 0) || 0
  });
}

export function mapPodcastProgram(raw: unknown, fallbackRadio?: Partial<PodcastRadio>): PodcastProgram {
  const p = record(raw);
  const mainSong = record(p.mainSong ?? p.song ?? p.mainTrack);
  const radio = record(p.radio ?? fallbackRadio);
  const mappedRadio = safeMapPodcastRadio(radio, fallbackRadio);
  const artists = rawArtists(mainSong.ar ?? mainSong.artists);
  const album = record(mainSong.al ?? mainSong.album);
  const dj = record(p.dj ?? radio.dj);
  const playableId = stringId(mainSong.id ?? p.mainSongId ?? p.songId);
  return {
    type: "podcast",
    provider: "netease",
    id: playableId,
    sourceId: playableId,
    title: stringValue(p.name ?? mainSong.name),
    artists: artists.length ? artists : [mappedRadio.name || stringValue(dj.nickname) || mappedRadio.djName || "Podcast"],
    album: mappedRadio.name || stringValue(album.name) || "Podcast",
    coverUrl: stringValue(p.coverUrl ?? p.cover ?? p.blurCoverUrl ?? mappedRadio.coverUrl ?? album.picUrl),
    durationMs: numberOrUndefined(p.duration ?? mainSong.dt ?? mainSong.duration),
    qualityHints: ["standard"],
    playableState: "unknown",
    programId: stringId(p.id ?? p.programId),
    radioId: mappedRadio.id,
    radioName: mappedRadio.name,
    djName: mappedRadio.djName || stringValue(dj.nickname),
    description: stringValue(p.description ?? p.desc),
    createTime: Number(p.createTime ?? 0) || 0,
    serialNum: Number(p.serialNum ?? p.serial ?? 0) || 0
  };
}

export function podcastCollectionMeta(key: string, items: Array<{ coverUrl?: string; cover?: string; picUrl?: string }>): PodcastCollection {
  const meta = {
    collect: { key: "collect", title: "收藏播客", sub: "你收藏的播客", itemType: "radio" },
    created: { key: "created", title: "创建播客", sub: "你创建的播客", itemType: "radio" },
    liked: { key: "liked", title: "喜欢的声音", sub: "收藏或最近喜欢的声音", itemType: "voice" }
  }[key] ?? { key, title: key, sub: "", itemType: "radio" };
  const first = items[0] ?? {};
  return {
    ...meta,
    itemType: meta.itemType as "radio" | "voice",
    count: items.length,
    coverUrl: first.coverUrl || first.cover || first.picUrl || ""
  };
}

async function fetchMyPodcastItems(
  requester: PodcastRequester,
  key: string,
  info: PodcastLoginInfo,
  limit: number,
  offset: number
): Promise<{ itemType: "radio" | "voice"; items: Array<PodcastRadio | PodcastProgram> }> {
  if (key === "collect") {
    const resp = await callRequester(requester.djSublist, { limit, offset, ...authParams() });
    const raw = firstArrayFrom(bodyOf(resp), ["djRadios", "djradios", "radios", "data"]);
    return { itemType: "radio", items: raw.map(item => mapPodcastRadio(item)).filter(item => item.id) };
  }
  if (key === "created") {
    const resp = await callRequester(requester.userAudio, { uid: info.userId, ...authParams() });
    const raw = firstArrayFrom(bodyOf(resp), ["data", "djRadios", "djradios", "radios"]);
    return { itemType: "radio", items: raw.map(item => mapPodcastRadio(item)).filter(item => item.id) };
  }
  if (key === "paid") {
    const resp = await callRequester(requester.djPaygift, { limit, offset, ...authParams() });
    const raw = firstArrayFrom(bodyOf(resp), ["data", "djRadios", "djradios", "radios"]);
    return { itemType: "radio", items: raw.map(item => mapPodcastRadio(item)).filter(item => item.id) };
  }
  if (key === "liked") {
    const resp = await callRequester(requester.recordRecentVoice, { limit, ...authParams() });
    const raw = firstArrayFrom(bodyOf(resp), ["data", "list", "resources"]);
    return { itemType: "voice", items: raw.map(item => mapPodcastVoice(item)).filter(item => item.id && item.title) };
  }
  return { itemType: "radio", items: [] };
}

function mapPodcastVoice(raw: unknown): PodcastProgram {
  const v = record(raw);
  const source = record(v.resource ?? v.voice ?? v.data ?? v.program ?? v);
  const mainSong = record(source.mainSong ?? source.song ?? source.track);
  const radio = record(source.radio ?? source.djRadio ?? source.voiceList ?? source.podcast);
  return mapPodcastProgram({
    ...source,
    id: source.programId ?? source.voiceId ?? source.id,
    name: source.name ?? source.songName ?? source.title ?? mainSong.name,
    mainSong: {
      ...mainSong,
      id: source.trackId ?? source.songId ?? source.mainSongId ?? mainSong.id ?? source.id
    },
    radio: {
      ...radio,
      name: radio.name ?? radio.radioName ?? radio.voiceListName ?? source.podcastName ?? source.djName
    }
  });
}

function safeMapPodcastRadio(raw: unknown, fallback?: Partial<PodcastRadio>): PodcastRadio {
  try {
    return mapPodcastRadio(raw);
  } catch {
    const id = stringId(fallback?.id ?? fallback?.rid ?? record(raw).id ?? record(raw).rid);
    return PodcastRadioSchema.parse({
      id: id || "unknown",
      rid: id || "unknown",
      name: fallback?.name ?? "",
      coverUrl: fallback?.coverUrl ?? "",
      description: fallback?.description ?? "",
      djName: fallback?.djName ?? "",
      category: fallback?.category ?? "",
      programCount: fallback?.programCount ?? 0,
      subCount: fallback?.subCount ?? 0
    });
  }
}

function firstArrayFrom(obj: unknown, keys: string[]): unknown[] {
  const source = record(obj);
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
    const nested = record(value);
    if (Array.isArray(nested.list)) return nested.list;
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.resources)) return nested.resources;
  }
  return [];
}

async function callRequester<T extends NeteaseResponse>(
  fn: ((params: Record<string, unknown>) => Promise<T>) | undefined,
  params: Record<string, unknown>
): Promise<T> {
  if (!fn) throw new Error("podcast requester missing");
  return fn(params);
}

function bodyOf(resp: unknown): Record<string, unknown> {
  return record(record(resp).body ?? resp);
}

function authParams(): Record<string, unknown> {
  const cookie = getProviderCookie("netease");
  return cookie ? { cookie, timestamp: Date.now() } : {};
}

async function defaultLoginStatus(): Promise<PodcastLoginInfo> {
  return { loggedIn: !!getProviderCookie("netease") };
}

function defaultPodcastRequester(): PodcastRequester {
  let modulePromise: Promise<Record<string, (...args: any[]) => Promise<NeteaseResponse>>> | null = null;
  const load = async () => {
    modulePromise ??= import("NeteaseCloudMusicApi") as unknown as Promise<Record<string, (...args: any[]) => Promise<NeteaseResponse>>>;
    return modulePromise;
  };
  const call = (name: string) => async (params: Record<string, unknown>) => {
    const mod = await load();
    const fn = mod[name];
    if (!fn) throw new Error(`NeteaseCloudMusicApi missing ${name}`);
    return fn(params);
  };
  return {
    cloudsearch: call("cloudsearch"),
    djHot: call("dj_hot"),
    djDetail: call("dj_detail"),
    djProgram: call("dj_program"),
    djSublist: call("dj_sublist"),
    userAudio: call("user_audio"),
    djPaygift: call("dj_paygift"),
    recordRecentVoice: call("record_recent_voice")
  };
}

async function defaultBeatmapAnalyzer(url: string, opts: { durationSec: number; introSec?: number; userAgent: string }): Promise<Record<string, unknown>> {
  const analyzerModulePath: string = "../../../../dj-analyzer.js";
  const mod = await import(analyzerModulePath) as {
    analyzePodcastDjIntro?: (url: string, opts: { durationSec: number; introSec: number; userAgent: string }) => Promise<Record<string, unknown>>;
    analyzePodcastDjStream?: (url: string, opts: { durationSec: number; userAgent: string }) => Promise<Record<string, unknown>>;
  };
  if (opts.introSec && mod.analyzePodcastDjIntro) {
    return mod.analyzePodcastDjIntro(url, { durationSec: opts.durationSec, introSec: opts.introSec, userAgent: opts.userAgent });
  }
  if (!mod.analyzePodcastDjStream) throw new Error("podcast analyzer unavailable");
  return mod.analyzePodcastDjStream(url, { durationSec: opts.durationSec, userAgent: opts.userAgent });
}

function rawArtists(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => stringValue(record(item).name))
    .filter(Boolean);
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function stringId(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export const podcastService = createPodcastService();
