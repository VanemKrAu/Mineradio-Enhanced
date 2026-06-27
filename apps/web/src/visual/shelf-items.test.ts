import { expect, test } from "bun:test";
import type { Track } from "@mineradio/shared";
import { mapQueueToShelfItems } from "./shelf-items";

function track(
	id: string,
	title: string,
	artists: string[],
	album = "",
	coverUrl = "",
): Track {
	return {
		provider: "netease",
		id,
		sourceId: id,
		title,
		artists,
		album,
		coverUrl,
		durationMs: 180_000,
		qualityHints: [],
		playableState: "playable",
	};
}

test("mapQueueToShelfItems tags the current track as playing and numbers the rest", () => {
	const queue = [
		track("a", "First", ["Ada", "Lin"], "Album A", "cover-a"),
		track("b", "Second", [], "Album B", "cover-b"),
	];

	const items = mapQueueToShelfItems(queue, queue[1]);

	expect(items).toEqual([
		{
			type: "queue",
			title: "First",
			sub: "Ada / Lin",
			cover: "cover-a",
			tag: "#1",
			queueIndex: 0,
			provider: "netease",
		},
		{
			type: "queue",
			title: "Second",
			sub: "Album B",
			cover: "cover-b",
			tag: "正在播放",
			queueIndex: 1,
			provider: "netease",
		},
	]);
});

test("mapQueueToShelfItems returns no hidden Mineradio host fixture when queue is empty", () => {
	const items = mapQueueToShelfItems([], null);

	expect(items).toEqual([]);
	expect(JSON.stringify(items)).not.toContain("Tauri shelf host fixture");
	expect(JSON.stringify(items)).not.toContain("Mineradio");
});
