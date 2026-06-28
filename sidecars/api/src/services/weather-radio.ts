import { WeatherRadioResponseSchema, type Track, type WeatherMood, type WeatherRadioResponse, type WeatherSnapshot } from "@mineradio/shared";
import { crossSourceResolver, type CrossSourceResolver } from "./cross-source-resolver";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_DEFAULT_LOCATION = {
  name: "上海",
  country: "China",
  latitude: 31.2304,
  longitude: 121.4737,
  timezone: "Asia/Shanghai"
};

export type WeatherRadioParams = {
  city?: string;
  q?: string;
  location?: string;
  lat?: string | number;
  lon?: string | number;
  timezone?: string;
};

export type WeatherRadioDeps = {
  now?: () => number;
  fetchWeather?: (params: WeatherRadioParams) => Promise<WeatherSnapshot>;
  searchTracks?: (keyword: string, limit: number) => Promise<Track[]>;
};

export type WeatherRadioService = {
  build(params: WeatherRadioParams): Promise<WeatherRadioResponse>;
};

export function createWeatherRadioService(deps: WeatherRadioDeps = {}): WeatherRadioService {
  return {
    build(params) {
      return buildWeatherRadio(params, deps);
    }
  };
}

export async function buildWeatherRadio(params: WeatherRadioParams, deps: WeatherRadioDeps = {}): Promise<WeatherRadioResponse> {
  const now = deps.now ?? Date.now;
  let weather: WeatherSnapshot;
  try {
    weather = await (deps.fetchWeather ?? fetchOpenMeteoWeather)(params);
  } catch (err) {
    weather = fallbackWeatherForRadio(params, err, now());
  }

  const queries = weatherRadioSeedQueries(weather.mood);
  const searchTracks = deps.searchTracks ?? defaultSearchTracks(crossSourceResolver);
  let songs: Track[] = [];
  const settled = await Promise.allSettled(queries.slice(0, 4).map(query => searchTracks(query, 6)));
  settled.forEach(result => {
    if (result.status === "fulfilled") songs = songs.concat(result.value);
  });
  if (songs.length < 10 && weather.mood.keywords.length > 0) {
    const more = await Promise.allSettled(weather.mood.keywords.slice(0, 2).map(query => searchTracks(query, 6)));
    more.forEach(result => {
      if (result.status === "fulfilled") songs = songs.concat(result.value);
    });
  }

  const body = {
    ok: true,
    weather,
    radio: {
      title: weather.mood.title,
      subtitle: weather.mood.tagline,
      seedQueries: queries.slice(0, 4),
      songs: orderWeatherSongs(songs, weather.mood).slice(0, 18),
      updatedAt: now()
    }
  };
  return WeatherRadioResponseSchema.parse(body);
}

function defaultSearchTracks(resolver: CrossSourceResolver): (keyword: string, limit: number) => Promise<Track[]> {
  return (keyword, limit) => resolver.resolveSearch({ keyword, limit });
}

export function openMeteoWeatherLabel(code: unknown): string {
  const n = Number(code);
  if (n === 0) return "晴";
  if (n === 1 || n === 2) return "少云";
  if (n === 3) return "阴";
  if (n === 45 || n === 48) return "雾";
  if (n === 51 || n === 53 || n === 55) return "毛毛雨";
  if (n === 56 || n === 57) return "冻雨";
  if (n === 61 || n === 63 || n === 65) return "雨";
  if (n === 66 || n === 67) return "冻雨";
  if (n === 71 || n === 73 || n === 75 || n === 77) return "雪";
  if (n === 80 || n === 81 || n === 82) return "阵雨";
  if (n === 85 || n === 86) return "阵雪";
  if (n === 95 || n === 96 || n === 99) return "雷雨";
  return "天气";
}

export function buildWeatherMood(weather: Partial<WeatherSnapshot>, date = new Date()): WeatherMood {
  const hour = date.getHours();
  const code = Number(weather.weatherCode);
  const temp = Number(weather.temperature);
  const apparent = Number(weather.apparentTemperature);
  const rain = Number(weather.precipitation) || 0;
  const humidity = Number(weather.humidity) || 0;
  const wind = Number(weather.windSpeed) || 0;
  const isNight = weather.isDay === 0 || hour < 6 || hour >= 20;
  const isMorning = hour >= 5 && hour < 11;
  const isDusk = hour >= 17 && hour < 20;
  const isRain = rain > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(code);
  const isCloud = [2, 3, 45, 48].includes(code);
  const isStorm = [95, 96, 99].includes(code);
  const feels = Number.isFinite(apparent) ? apparent : temp;

  let mood: WeatherMood = {
    key: "clear",
    title: "晴朗电台",
    tagline: "让节奏亮一点，像窗边的光",
    energy: 0.62,
    warmth: 0.58,
    focus: 0.48,
    melancholy: 0.24,
    keywords: ["轻快 华语", "city pop", "indie pop", "chill pop", "阳光 歌单"]
  };
  if (isStorm) {
    mood = {
      key: "storm",
      title: "雷雨电台",
      tagline: "低频更厚，适合把世界关小一点",
      energy: 0.46,
      warmth: 0.34,
      focus: 0.66,
      melancholy: 0.62,
      keywords: ["暗色 R&B", "trip hop", "夜晚 电子", "氛围 摇滚", "雨夜 歌单"]
    };
  } else if (isRain) {
    mood = {
      key: "rain",
      title: "雨天电台",
      tagline: "留一点潮湿的空间给旋律",
      energy: 0.38,
      warmth: 0.42,
      focus: 0.64,
      melancholy: 0.66,
      keywords: ["雨天 R&B", "lofi rainy", "华语 慢歌", "dream pop", "雨夜 歌单"]
    };
  } else if (isSnow || feels <= 3) {
    mood = {
      key: "snow",
      title: "冷空气电台",
      tagline: "干净、慢速、带一点冬天的颗粒感",
      energy: 0.34,
      warmth: 0.28,
      focus: 0.72,
      melancholy: 0.54,
      keywords: ["冬天 民谣", "ambient piano", "日系 冬天", "indie folk", "安静 歌单"]
    };
  } else if (feels >= 31 || humidity >= 78) {
    mood = {
      key: "humid",
      title: "闷热电台",
      tagline: "降低密度，留出一点呼吸",
      energy: 0.48,
      warmth: 0.76,
      focus: 0.46,
      melancholy: 0.30,
      keywords: ["夏日 chill", "bossa nova", "city pop 夏天", "轻电子", "海边 歌单"]
    };
  } else if (isCloud) {
    mood = {
      key: "cloudy",
      title: "阴天电台",
      tagline: "不急着明亮，先让声音变软",
      energy: 0.40,
      warmth: 0.46,
      focus: 0.58,
      melancholy: 0.52,
      keywords: ["阴天 华语", "indie rock mellow", "neo soul", "chillhop", "独立 民谣"]
    };
  }

  if (isNight) {
    mood.key += "-night";
    mood.title = mood.key.startsWith("clear") ? "夜色电台" : mood.title.replace("电台", "夜听");
    mood.tagline = "音量放低一点，让夜色参与编曲";
    mood.energy = Math.min(mood.energy, 0.42);
    mood.focus = Math.max(mood.focus, 0.68);
    mood.melancholy = Math.max(mood.melancholy, 0.52);
    mood.keywords = ["夜晚 R&B", "late night jazz", "ambient", "lofi sleep", "夜跑 歌单"].concat(mood.keywords.slice(0, 3));
  } else if (isMorning) {
    mood.title = mood.key.startsWith("rain") ? "雨晨电台" : "早晨电台";
    mood.energy = Math.max(mood.energy, 0.52);
    mood.keywords = ["早晨 通勤", "morning acoustic", "清晨 indie", "轻快 华语"].concat(mood.keywords.slice(0, 3));
  } else if (isDusk) {
    mood.title = mood.key.startsWith("rain") ? "黄昏雨声" : "黄昏电台";
    mood.melancholy = Math.max(mood.melancholy, 0.48);
    mood.keywords = ["黄昏 city pop", "日落 歌单", "落日飞车", "soul pop"].concat(mood.keywords.slice(0, 3));
  }

  if (wind >= 28) {
    mood.energy = Math.max(mood.energy, 0.56);
    mood.keywords = ["公路 摇滚", "windy day playlist"].concat(mood.keywords.slice(0, 4));
  }
  mood.keywords = Array.from(new Set(mood.keywords)).slice(0, 7);
  return mood;
}

async function fetchOpenMeteoWeather(params: WeatherRadioParams): Promise<WeatherSnapshot> {
  const location = await resolveOpenMeteoLocation(params);
  const u = new URL(OPEN_METEO_FORECAST_URL);
  u.searchParams.set("latitude", String(location.latitude));
  u.searchParams.set("longitude", String(location.longitude));
  u.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m");
  u.searchParams.set("hourly", "precipitation_probability,weather_code,temperature_2m");
  u.searchParams.set("forecast_days", "1");
  u.searchParams.set("timezone", location.timezone || "auto");
  const body = await requestJson(u.toString());
  const cur = body && typeof body === "object" && "current" in body ? (body as { current?: Record<string, unknown> }).current ?? {} : {};
  const weather = {
    provider: "open-meteo",
    location: {
      name: location.name,
      country: location.country,
      admin1: location.admin1,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: typeof (body as { timezone?: unknown }).timezone === "string" ? (body as { timezone: string }).timezone : location.timezone,
      fallback: location.fallback
    },
    label: openMeteoWeatherLabel(cur.weather_code),
    weatherCode: finiteOrNull(cur.weather_code),
    temperature: finiteOrNull(cur.temperature_2m),
    apparentTemperature: finiteOrNull(cur.apparent_temperature),
    humidity: finiteOrNull(cur.relative_humidity_2m),
    precipitation: finiteOrNull(Number(cur.precipitation || cur.rain || cur.showers || cur.snowfall || 0)),
    cloudCover: finiteOrNull(cur.cloud_cover),
    windSpeed: finiteOrNull(cur.wind_speed_10m),
    windGusts: finiteOrNull(cur.wind_gusts_10m),
    isDay: finiteOrNull(cur.is_day),
    time: typeof cur.time === "string" ? cur.time : "",
    updatedAt: Date.now()
  };
  return WeatherRadioResponseSchema.shape.weather.parse({
    ...weather,
    mood: buildWeatherMood(weather)
  });
}

async function resolveOpenMeteoLocation(params: WeatherRadioParams): Promise<{
  name: string;
  country: string;
  admin1: string;
  latitude: number;
  longitude: number;
  timezone: string;
  fallback: boolean;
}> {
  const lat = clampNumber(params.lat, -90, 90, NaN);
  const lon = clampNumber(params.lon, -180, 180, NaN);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      name: String(params.city || params.q || params.location || "当前位置").trim() || "当前位置",
      country: "",
      admin1: "",
      latitude: lat,
      longitude: lon,
      timezone: params.timezone || "auto",
      fallback: false
    };
  }

  const raw = String(params.city || params.q || params.location || "").trim();
  if (!raw) return { ...WEATHER_DEFAULT_LOCATION, admin1: "", fallback: false };
  const u = new URL(OPEN_METEO_GEOCODE_URL);
  u.searchParams.set("name", raw);
  u.searchParams.set("count", "1");
  u.searchParams.set("language", "zh");
  u.searchParams.set("format", "json");
  const body = await requestJson(u.toString());
  const first = body && typeof body === "object" && Array.isArray((body as { results?: unknown[] }).results)
    ? (body as { results: Array<Record<string, unknown>> }).results[0]
    : null;
  if (!first) return { ...WEATHER_DEFAULT_LOCATION, admin1: "", fallback: true };
  return {
    name: typeof first.name === "string" ? first.name : raw,
    country: typeof first.country === "string" ? first.country : "",
    admin1: typeof first.admin1 === "string" ? first.admin1 : "",
    latitude: Number(first.latitude),
    longitude: Number(first.longitude),
    timezone: typeof first.timezone === "string" ? first.timezone : "auto",
    fallback: false
  };
}

async function requestJson(target: string): Promise<unknown> {
  const res = await fetch(target, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`weather request failed: ${res.status}`);
  return res.json();
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fallbackWeatherForRadio(params: WeatherRadioParams, err: unknown, now: number): WeatherSnapshot {
  const name = String(params.city || params.q || params.location || WEATHER_DEFAULT_LOCATION.name).trim() || WEATHER_DEFAULT_LOCATION.name;
  return {
    provider: "open-meteo",
    location: {
      name,
      country: "",
      admin1: "",
      latitude: null,
      longitude: null,
      timezone: params.timezone || WEATHER_DEFAULT_LOCATION.timezone,
      fallback: true
    },
    label: "天气暂不可用",
    weatherCode: null,
    temperature: null,
    apparentTemperature: null,
    humidity: null,
    precipitation: null,
    cloudCover: null,
    windSpeed: null,
    windGusts: null,
    isDay: null,
    time: "",
    updatedAt: now,
    error: err instanceof Error ? err.message : "",
    mood: {
      key: "fallback",
      title: "临时电台",
      tagline: "天气暂时没有回来，先放一组稳妥的歌",
      energy: 0.54,
      warmth: 0.55,
      focus: 0.55,
      melancholy: 0.35,
      keywords: ["华语 流行", "indie pop", "city pop", "轻快 歌单", "chill pop"]
    }
  };
}

function weatherRadioSeedQueries(mood: WeatherMood): string[] {
  const key = mood.key;
  if (key.includes("rain") || key.includes("storm")) return ["陈奕迅 阴天快乐", "周杰伦 雨下一整晚", "孙燕姿 遇见", "林宥嘉 说谎", "毛不易 消愁"];
  if (key.includes("snow") || key.includes("cloudy")) return ["陈奕迅 好久不见", "莫文蔚 阴天", "李健 贝加尔湖畔", "朴树 平凡之路", "蔡健雅 达尔文"];
  if (key.includes("humid")) return ["落日飞车 My Jinji", "告五人 爱人错过", "夏日入侵企画 想去海边", "陈绮贞 旅行的意义", "王若琳 Lost in Paradise"];
  if (key.includes("night")) return ["方大同 特别的人", "陶喆 爱很简单", "Frank Ocean Pink + White", "林忆莲 夜太黑", "Norah Jones Don't Know Why"];
  return ["孙燕姿 天黑黑", "周杰伦 晴天", "五月天 温柔", "陈奕迅 稳稳的幸福", "王菲"];
}

function orderWeatherSongs(songs: Track[], mood: WeatherMood): Track[] {
  const sorted = uniqueSongsByKey(songs)
    .filter(song => song.title && song.id && !isLowSignalWeatherSong(song))
    .sort((a, b) => scoreWeatherSong(b, mood) - scoreWeatherSong(a, mood));
  return diversifyWeatherSongs(uniqueWeatherTitles(sorted), 2);
}

function uniqueSongsByKey(songs: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  songs.forEach(song => {
    const key = String(song.id || `${song.title}|${song.artists.join("/")}`).trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(song);
  });
  return out;
}

function isLowSignalWeatherSong(song: Track): boolean {
  const text = `${song.title} ${song.artists.join(" ")} ${song.album || ""}`.toLowerCase();
  if (!text.trim()) return true;
  if (/(^|[\s\-_/（(])ai(?:\s*(歌|歌曲|音乐|cover|翻唱|生成|作曲|演唱|女声|男声)|$|[\s\-_/）)])/i.test(text)) return true;
  if (/suno|udio|人工智能|生成歌曲|ai歌曲|虚拟歌手|测试音频|demo|beat\s*maker/i.test(text)) return true;
  if (/翻自|翻唱|cover|remix|伴奏|纯音乐|钢琴|dj|live\s*版|live版|唯美钢琴|karaoke|instrumental/i.test(text)) return true;
  if (/白噪音|雨声|睡眠|助眠|冥想|疗愈频率|环境音|自然声音|asmr/i.test(text)) return true;
  if (/[（(](r&b|lofi|jazz|dj|edm|trap|remix|伴奏|纯音乐|钢琴|电子|治愈|古风|女声|男声|英文|中文版|抖音|ai)[）)]/i.test(text)) return true;
  if (/^(纯音乐|轻音乐|治愈系|放松|睡眠|雨天|阴天|夜晚|夏日|海边)$/i.test(song.title.trim())) return true;
  return false;
}

function scoreWeatherSong(song: Track, mood: WeatherMood): number {
  const text = `${song.title} ${song.artists.join(" ")} ${song.album || ""}`.toLowerCase();
  let score = 0;
  if (song.coverUrl) score += 4;
  if (song.durationMs) score += 2;
  if (/周杰伦|陈奕迅|孙燕姿|五月天|王菲|陶喆|方大同|林宥嘉|蔡健雅|莫文蔚|李健|毛不易|告五人|落日飞车|陈绮贞|朴树/.test(text)) score += 10;
  const key = mood.key;
  if (key.includes("rain") && /雨|阴|夜|慢|r&b|soul|陈奕迅|林宥嘉|孙燕姿/.test(text)) score += 5;
  if (key.includes("humid") && /夏|海|city|pop|落日|告五人|方大同|陶喆/.test(text)) score += 5;
  if (key.includes("night") && /夜|moon|jazz|soul|r&b|方大同|陶喆|王菲/.test(text)) score += 5;
  if (key.includes("cloudy") && /阴|民谣|indie|陈绮贞|朴树|李健/.test(text)) score += 5;
  return score;
}

function uniqueWeatherTitles(sorted: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  sorted.forEach(song => {
    const key = weatherTitleKey(song);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    out.push(song);
  });
  return out;
}

function weatherTitleKey(song: Track): string {
  return song.title
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\s._\-·'’"“”「」《》:：/\\|]+/g, "")
    .trim();
}

function diversifyWeatherSongs(sorted: Track[], artistLimit: number): Track[] {
  const primary: Track[] = [];
  const deferred: Track[] = [];
  const counts = new Map<string, number>();
  sorted.forEach(song => {
    const key = weatherArtistKey(song);
    const count = counts.get(key) || 0;
    if (count < artistLimit) {
      primary.push(song);
      counts.set(key, count + 1);
    } else {
      deferred.push(song);
    }
  });
  return primary.length >= 8 ? primary : primary.concat(deferred.slice(0, 8 - primary.length));
}

function weatherArtistKey(song: Track): string {
  const raw = (song.artists[0] || song.title || "").split(/\s*\/\s*|、|,|&/)[0] || "";
  return raw.trim().toLowerCase() || "unknown";
}

export const weatherRadio = createWeatherRadioService();
