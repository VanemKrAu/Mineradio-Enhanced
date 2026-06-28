import { expect, test } from "bun:test";
import {
  PodcastProgramsResponseSchema,
  PodcastSearchResponseSchema,
  PodcastMyResponseSchema
} from "./podcast";

test("podcast radio search response carries baseline radio metadata", () => {
  const parsed = PodcastSearchResponseSchema.parse({
    podcasts: [{
      id: 123,
      rid: 123,
      name: "夜听",
      coverUrl: "https://example.com/c.jpg",
      description: "desc",
      djName: "DJ",
      category: "情感",
      programCount: 9,
      subCount: 12
    }],
    total: 1
  });

  expect(parsed.podcasts[0].id).toBe("123");
  expect(parsed.podcasts[0].coverUrl).toBe("https://example.com/c.jpg");
});

test("podcast programs response maps long audio programs as playable tracks", () => {
  const parsed = PodcastProgramsResponseSchema.parse({
    radio: { id: "r1", rid: "r1", name: "电台" },
    programs: [{
      type: "podcast",
      provider: "netease",
      id: "song-1",
      sourceId: "song-1",
      title: "第 1 期",
      artists: ["电台"],
      album: "电台",
      coverUrl: "",
      qualityHints: [],
      playableState: "unknown",
      programId: "p1",
      radioId: "r1"
    }],
    more: false,
    total: 1
  });

  expect(parsed.programs[0].type).toBe("podcast");
  expect(parsed.programs[0].programId).toBe("p1");
});

test("podcast my response keeps logged-out collections compatible with baseline", () => {
  const parsed = PodcastMyResponseSchema.parse({
    loggedIn: false,
    collections: [
      { key: "collect", title: "收藏播客", itemType: "radio" },
      { key: "liked", title: "喜欢的声音", itemType: "voice" }
    ]
  });

  expect(parsed.collections[0].count).toBe(0);
  expect(parsed.collections[1].itemType).toBe("voice");
});
