import { expect, test } from "bun:test";
import type { Track } from "@mineradio/shared";
import { buildWeatherRadio, buildWeatherMood, openMeteoWeatherLabel } from "./weather-radio";

const track = (id: string, title: string, artist = "陈奕迅"): Track => ({
  provider: "netease",
  id,
  sourceId: id,
  title,
  artists: [artist],
  album: "",
  coverUrl: "",
  durationMs: 180000,
  qualityHints: ["standard"],
  playableState: "playable"
});

test("openMeteoWeatherLabel preserves baseline weather code labels", () => {
  expect(openMeteoWeatherLabel(0)).toBe("晴");
  expect(openMeteoWeatherLabel(61)).toBe("雨");
  expect(openMeteoWeatherLabel(95)).toBe("雷雨");
});

test("buildWeatherMood maps rainy weather to the baseline rainy radio copy", () => {
  const mood = buildWeatherMood({
    weatherCode: 61,
    temperature: 22,
    apparentTemperature: 21,
    precipitation: 1,
    humidity: 88,
    windSpeed: 6,
    isDay: 1
  }, new Date(2026, 5, 29, 13));

  expect(mood.key).toBe("rain");
  expect(mood.title).toBe("雨天电台");
  expect(mood.keywords).toContain("雨天 R&B");
});

test("buildWeatherRadio falls back to temporary radio when weather provider fails", async () => {
  const searched: string[] = [];
  const result = await buildWeatherRadio(
    { city: "上海" },
    {
      now: () => 123,
      async fetchWeather() {
        throw new Error("network down");
      },
      async searchTracks(keyword, limit) {
        searched.push(`${keyword}:${limit}`);
        return [track(keyword, keyword)];
      }
    }
  );

  expect(result.ok).toBe(true);
  expect(result.weather.label).toBe("天气暂不可用");
  expect(result.radio.title).toBe("临时电台");
  expect(result.radio.songs.length).toBe(6);
  expect(searched[0]).toBe("孙燕姿 天黑黑:6");
});

test("buildWeatherRadio orders and filters weather songs like baseline pool cleanup", async () => {
  const result = await buildWeatherRadio(
    { city: "上海" },
    {
      now: () => 123,
      async fetchWeather() {
        return {
          provider: "open-meteo",
          location: {
            name: "上海",
            country: "中国",
            admin1: "",
            latitude: 31.23,
            longitude: 121.47,
            timezone: "Asia/Shanghai",
            fallback: false
          },
          label: "雨",
          weatherCode: 61,
          temperature: 22,
          apparentTemperature: 21,
          humidity: 88,
          precipitation: 1,
          cloudCover: 90,
          windSpeed: 6,
          windGusts: 10,
          isDay: 1,
          time: "",
          updatedAt: 100,
          error: "",
          mood: buildWeatherMood({
            weatherCode: 61,
            temperature: 22,
            apparentTemperature: 21,
            precipitation: 1,
            humidity: 88,
            windSpeed: 6,
            isDay: 1
          }, new Date(2026, 5, 29, 13))
        };
      },
      async searchTracks(keyword) {
        return [
          track("same", "阴天快乐"),
          track("ai", "AI 翻唱 demo"),
          track(`id-${keyword}`, keyword)
        ];
      }
    }
  );

  expect(result.weather.mood.title).toBe("雨天电台");
  expect(result.radio.seedQueries[0]).toBe("陈奕迅 阴天快乐");
  expect(result.radio.songs.map(song => song.title)).not.toContain("AI 翻唱 demo");
  expect(result.radio.songs.filter(song => song.id === "same").length).toBe(1);
});
