import { expect, test } from "bun:test";
import { WeatherRadioResponseSchema } from "./weather";

test("weather radio response carries weather mood and playable track pool", () => {
  const parsed = WeatherRadioResponseSchema.parse({
    ok: true,
    weather: {
      provider: "open-meteo",
      location: {
        name: "上海",
        country: "中国",
        latitude: 31.23,
        longitude: 121.47,
        timezone: "Asia/Shanghai"
      },
      label: "雨",
      weatherCode: 61,
      temperature: 22,
      apparentTemperature: 21,
      humidity: 88,
      precipitation: 1.2,
      cloudCover: 90,
      windSpeed: 8,
      windGusts: 12,
      isDay: 1,
      updatedAt: 1,
      mood: {
        key: "rain",
        title: "雨天电台",
        tagline: "留一点潮湿的空间给旋律",
        energy: 0.38,
        warmth: 0.42,
        focus: 0.64,
        melancholy: 0.66,
        keywords: ["雨天 R&B"]
      }
    },
    radio: {
      title: "雨天电台",
      subtitle: "留一点潮湿的空间给旋律",
      seedQueries: ["陈奕迅 阴天快乐"],
      songs: [
        {
          provider: "netease",
          id: "1",
          sourceId: "1",
          title: "阴天快乐",
          artists: ["陈奕迅"],
          album: "",
          coverUrl: "",
          qualityHints: [],
          playableState: "playable"
        }
      ],
      updatedAt: 1
    }
  });

  expect(parsed.weather.mood.key).toBe("rain");
  expect(parsed.radio.songs[0].title).toBe("阴天快乐");
});
