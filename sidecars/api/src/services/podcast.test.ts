import { expect, test } from "bun:test";
import { createPodcastService, mapPodcastProgram, mapPodcastRadio, podcastCollectionMeta } from "./podcast";

test("mapPodcastRadio preserves baseline radio metadata fallbacks", () => {
  const radio = mapPodcastRadio({
    rid: 42,
    radioName: "夜听",
    picUrl: "cover",
    dj: { nickname: "DJ" },
    categoryName: "情感",
    programNum: 7,
    subedCount: 9
  });

  expect(radio.id).toBe("42");
  expect(radio.name).toBe("夜听");
  expect(radio.coverUrl).toBe("cover");
  expect(radio.djName).toBe("DJ");
  expect(radio.programCount).toBe(7);
});

test("mapPodcastProgram maps mainSong long audio to playable netease track", () => {
  const program = mapPodcastProgram({
    id: "p1",
    name: "第 1 期",
    radio: { id: "r1", name: "电台", picUrl: "r-cover" },
    mainSong: {
      id: 100,
      name: "音频",
      ar: [{ name: "主播" }],
      al: { name: "专辑", picUrl: "song-cover" },
      dt: 120000
    }
  });

  expect(program.type).toBe("podcast");
  expect(program.id).toBe("100");
  expect(program.programId).toBe("p1");
  expect(program.title).toBe("第 1 期");
  expect(program.radioName).toBe("电台");
});

test("podcast service search calls cloudsearch type 1009 and maps radios", async () => {
  const calls: unknown[] = [];
  const service = createPodcastService({
    requester: {
      async cloudsearch(params) {
        calls.push(params);
        return { body: { result: { djRadios: [{ id: 1, name: "播客" }], djRadiosCount: 1 } } };
      }
    }
  });

  const result = await service.search({ keywords: "故事", limit: 18 });

  expect(calls[0]).toEqual({ keywords: "故事", type: 1009, limit: 18 });
  expect(result.podcasts[0].name).toBe("播客");
  expect(result.total).toBe(1);
});

test("podcast service programs maps radio and program list", async () => {
  const service = createPodcastService({
    requester: {
      async djProgram(params) {
        expect(params).toEqual({ rid: "r1", limit: 30, offset: 0, asc: false });
        return {
          body: {
            programs: [
              {
                id: "p1",
                name: "节目",
                radio: { id: "r1", name: "电台" },
                mainSong: { id: "s1", name: "音频", ar: [], al: {}, dt: 1000 }
              }
            ],
            more: true,
            count: 1
          }
        };
      }
    }
  });

  const result = await service.programs({ rid: "r1", limit: 30, offset: 0 });

  expect(result.radio.id).toBe("r1");
  expect(result.programs[0].id).toBe("s1");
  expect(result.more).toBe(true);
});

test("podcast service returns baseline logged-out my collections", async () => {
  const service = createPodcastService({
    loginStatus: async () => ({ loggedIn: false })
  });

  const result = await service.my();

  expect(result.loggedIn).toBe(false);
  expect(result.collections.map(item => item.key)).toEqual(["collect", "created", "liked"]);
});

test("podcast collection meta mirrors baseline labels and cover selection", () => {
  const meta = podcastCollectionMeta("liked", [{ coverUrl: "cover" }]);
  expect(meta.title).toBe("喜欢的声音");
  expect(meta.itemType).toBe("voice");
  expect(meta.coverUrl).toBe("cover");
});

test("podcast service delegates dj beatmap analyzer", async () => {
  const service = createPodcastService({
    beatmapAnalyzer: async (url, opts) => ({ url, opts, visualBeatCount: 3 })
  });

  const result = await service.djBeatmap({ url: "https://example.com/a.mp3", durationSec: 30, introSec: 5 });

  expect(result.ok).toBe(true);
  expect(result.map.visualBeatCount).toBe(3);
});
