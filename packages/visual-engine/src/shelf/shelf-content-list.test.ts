import { expect, test } from "bun:test";
import { getDefaultShelfLayoutProfile } from "./shelf-layout-profile";
import { SHELF_SETTINGS } from "./shelf-settings";
import {
	CONTENT_MAX_RENDER,
	CONTENT_VISIBLE_RADIUS,
	SHELF_CONTENT_PANEL_SCREEN_HEIGHT,
	SHELF_CONTENT_PANEL_SCREEN_PAD,
	SHELF_CONTENT_PANEL_SCREEN_WIDTH,
	SHELF_CONTENT_ROW_SCREEN_HEIGHT,
	SHELF_CONTENT_ROW_SCREEN_PAD_X,
	SHELF_CONTENT_ROW_SCREEN_PAD_Y,
	SHELF_CONTENT_ROW_SCREEN_WIDTH,
	computeContentPanelOpacity,
	createShelfContentList,
	pickShelfContentRowAtScreen,
	screenContainsShelfContentPanel,
	type ShelfContentRow,
} from "./shelf-content-list";

function makeRows(count: number): ShelfContentRow[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `song-${index}`,
		name: `Song ${index}`,
		artist: `Artist ${index}`,
		provider: "netease",
	}));
}

function settleCenter(list: ReturnType<typeof createShelfContentList>, now = 1): void {
	for (let i = 0; i < 64; i++) {
		list.advance(now);
	}
}

test("ShelfContentList.open resets baseline open state and advances request token", () => {
	const list = createShelfContentList({ now: () => 12.5 });
	list.scrollBy(99);
	list.open({ playlistId: "p1", title: "First" });
	const first = list.getSnapshot();

	expect(list.isOpen()).toBe(true);
	expect(first.playlistId).toBe("p1");
	expect(first.playlistTitle).toBe("First");
	expect(first.centerTarget).toBe(0);
	expect(first.centerSmooth).toBe(0);
	expect(first.openAnimAt).toBe(12.5);
	expect(first.rowAnimAt).toBe(12.5);
	expect(first.requestToken).toBe(1);
	expect(list.getRows()).toEqual([{ name: "加载中…", artist: "", kind: "loading" }]);

	list.open({ playlistId: "p2", title: "Second", kind: "podcast" });
	const second = list.getSnapshot();
	expect(second.requestToken).toBe(2);
	expect(second.contentKind).toBe("podcast");
	expect(second.playlistTitle).toBe("Second");
	expect(list.getCenterIdx()).toBe(0);
});

test("ShelfContentList.close clears rows and invalidates pending request token", () => {
	const list = createShelfContentList({ now: () => 1 });
	list.open({ playlistId: "p1", title: "A" });
	list.setRows(makeRows(3));
	list.scrollBy(2);
	list.close();
	const snap = list.getSnapshot();

	expect(list.isOpen()).toBe(false);
	expect(list.getRows()).toEqual([]);
	expect(snap.requestToken).toBe(2);
	expect(snap.centerTarget).toBe(2);
	expect(snap.centerSmooth).toBe(0);
	expect(snap.contentKind).toBe("playlist");
	expect(snap.playlistTitle).toBe("");
});

test("ShelfContentList.open derives podcast content kind from baseline podcast id prefix", () => {
	const list = createShelfContentList();
	list.open({ playlistId: "podcast:daily", title: "Daily" });

	expect(list.getSnapshot().contentKind).toBe("podcast");
});

test("ShelfContentList loading and error helpers create baseline placeholder rows", () => {
	const list = createShelfContentList();
	list.open({ playlistId: "p1", title: "A" });

	list.setError("歌单加载失败");
	expect(list.getRows()).toEqual([{ name: "歌单加载失败", artist: "", kind: "error" }]);

	list.setLoading();
	expect(list.getRows()).toEqual([{ name: "加载中…", artist: "", kind: "loading" }]);
});

test("ShelfContentList token-guarded row updates ignore stale playlist detail responses", () => {
	const list = createShelfContentList();
	const staleToken = list.open({ playlistId: "p1", title: "First" });
	const currentToken = list.open({ playlistId: "p2", title: "Second" });

	list.setRowsForToken(staleToken, [{ id: "old", name: "Old song" }]);

	expect(list.getRows()).toEqual([{ name: "加载中…", artist: "", kind: "loading" }]);

	list.setRowsForToken(currentToken, [{ id: "new", name: "New song", provider: "netease" }]);

	expect(list.getRows()).toEqual([{ id: "new", name: "New song", provider: "netease" }]);
});

test("ShelfContentList token-guarded errors ignore stale playlist detail failures", () => {
	const list = createShelfContentList();
	const staleToken = list.open({ playlistId: "p1", title: "First" });
	const currentToken = list.open({ playlistId: "p2", title: "Second" });

	list.setErrorForToken(staleToken, "旧请求失败");

	expect(list.getRows()).toEqual([{ name: "加载中…", artist: "", kind: "loading" }]);

	list.setErrorForToken(currentToken, "歌单加载失败");

	expect(list.getRows()).toEqual([{ name: "歌单加载失败", artist: "", kind: "error" }]);
});

test("ShelfContentList scroll clamps target and emits optional row tick only on movement", () => {
	const ticks: Array<{ delta: number; kind: "row" }> = [];
	const list = createShelfContentList({ onSelectTick: (delta, kind) => ticks.push({ delta, kind }) });
	list.open({ playlistId: "p1", title: "A" });
	list.setRows(makeRows(4));

	list.scrollBy(2);
	expect(list.getSnapshot().centerTarget).toBe(2);
	list.scrollBy(99);
	expect(list.getSnapshot().centerTarget).toBe(3);
	list.scrollBy(99);
	expect(list.getSnapshot().centerTarget).toBe(3);
	list.prev();
	expect(list.getSnapshot().centerTarget).toBe(2);
	list.next();
	expect(list.getSnapshot().centerTarget).toBe(3);

	expect(ticks).toEqual([
		{ delta: 2, kind: "row" },
		{ delta: 99, kind: "row" },
		{ delta: -1, kind: "row" },
		{ delta: 1, kind: "row" },
	]);
});

test("ShelfContentList.advance lerps centerSmooth with baseline 0.18", () => {
	const list = createShelfContentList();
	list.open({ playlistId: "p1", title: "A" });
	list.setRows(makeRows(4));
	list.scrollBy(1);

	list.advance(2);
	expect(list.getSnapshot().centerSmooth).toBeCloseTo(0.18, 6);
});

test("ShelfContentList.computeRenderWindow uses max 11 rows around centerTarget", () => {
	const list = createShelfContentList();
	list.open({ playlistId: "p1", title: "A" });
	list.setRows(makeRows(25));
	list.scrollBy(12);

	expect(CONTENT_VISIBLE_RADIUS).toBe(5);
	expect(CONTENT_MAX_RENDER).toBe(11);
	expect(list.computeRenderWindow()).toEqual({ start: 7, end: 17 });

	list.scrollBy(99);
	expect(list.computeRenderWindow()).toEqual({ start: 14, end: 24 });
});

test("ShelfContentList.computeRowLayout preserves non-skull row constants and reveal timing", () => {
	const list = createShelfContentList({ now: () => 0 });
	list.open({ playlistId: "p1", title: "A" });
	list.setRows(makeRows(7));
	list.scrollBy(2);
	settleCenter(list);
	const layout = getDefaultShelfLayoutProfile({ skullSafe: false }).detail;
	const row = list.computeRowLayout(2, {
		now: 0.36,
		layout,
		settings: SHELF_SETTINGS,
	});

	expect(row.visible).toBe(true);
	expect(row.revealRaw).toBeCloseTo(0.5, 6);
	expect(row.reveal).toBeCloseTo(0.5, 6);
	expect(row.renderOrder).toBe(324);
	expect(row.position.x).toBeCloseTo(0.15, 6);
	expect(row.position.y).toBeCloseTo(0.15, 6);
	expect(row.position.z).toBeCloseTo(0.54, 6);
	expect(row.scale).toBeCloseTo(0.95, 6);
	expect(row.opacity).toBeCloseTo(0.48, 6);
	expect(row.rotation.y).toBeCloseTo(0.126, 6);
	expect(row.rotation.x).toBeCloseTo(0, 6);
});

test("ShelfContentList.computeRowLayout preserves skull-safe row constants", () => {
	const list = createShelfContentList({ now: () => 0 });
	list.open({ playlistId: "p1", title: "A" });
	list.setRows(makeRows(7));
	list.scrollBy(2);
	settleCenter(list);
	const layout = getDefaultShelfLayoutProfile({ skullSafe: true }).detail;
	const row = list.computeRowLayout(2, {
		now: 0.72,
		layout,
		settings: SHELF_SETTINGS,
		skullSafe: true,
	});

	expect(row.visible).toBe(true);
	expect(row.revealRaw).toBe(1);
	expect(row.position.x).toBeCloseTo(0.22, 6);
	expect(row.position.y).toBeCloseTo(0, 6);
	expect(row.position.z).toBeCloseTo(0.62, 6);
	expect(row.scale).toBeCloseTo(1.02, 6);
	expect(row.opacity).toBeCloseTo(0.96, 6);
	expect(row.rotation.y).toBeCloseTo(-0.07, 6);
	expect(row.rotation.x).toBeCloseTo(0.01, 6);
});

test("ShelfContentList.computeRowLayout hides rows beyond baseline visible radius", () => {
	const list = createShelfContentList();
	list.open({ playlistId: "p1", title: "A" });
	list.setRows(makeRows(20));
	const row = list.computeRowLayout(7, {
		now: 1,
		layout: getDefaultShelfLayoutProfile().detail,
		settings: SHELF_SETTINGS,
	});

	expect(row.visible).toBe(false);
});

test("computeContentPanelOpacity preserves baseline 0.86 intro opacity", () => {
	expect(computeContentPanelOpacity({ now: 0.36, openAnimAt: 0, settings: SHELF_SETTINGS })).toBeCloseTo(0.4128, 6);
	expect(computeContentPanelOpacity({ now: 0.72, openAnimAt: 0, settings: SHELF_SETTINGS })).toBeCloseTo(0.8256, 6);
});

test("pickShelfContentRowAtScreen prefers higher renderOrder and returns padded baseline uv", () => {
	const low = { id: "low", name: "Low" };
	const high = { id: "high", name: "High" };
	const hit = pickShelfContentRowAtScreen([
		{
			row: low,
			index: 1,
			visible: true,
			renderOrder: 10,
			bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
		},
		{
			row: high,
			index: 7,
			visible: true,
			renderOrder: 20,
			bounds: { minX: 110, minY: 110, maxX: 210, maxY: 170 },
		},
	], { x: 90, y: 100 });

	expect(hit).toEqual({
		row: high,
		index: 7,
		uv: { x: 0, y: 1 },
		screenPick: true,
	});
});

test("pickShelfContentRowAtScreen returns null outside baseline row padding", () => {
	const row = { id: "row", name: "Row" };

	expect(pickShelfContentRowAtScreen([
		{
			row,
			index: 0,
			visible: true,
			renderOrder: 1,
			bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
		},
	], { x: 75, y: 100 })).toBeNull();
	expect(pickShelfContentRowAtScreen([
		{
			row,
			index: 0,
			visible: true,
			renderOrder: 1,
			bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
		},
	], { x: 100, y: 83 })).toBeNull();
});

test("pickShelfContentRowAtScreen ignores zero-area row bounds", () => {
	const row = { id: "row", name: "Row" };

	expect(pickShelfContentRowAtScreen([
		{
			row,
			index: 0,
			visible: true,
			renderOrder: 1,
			bounds: { minX: 100, minY: 100, maxX: 100, maxY: 160 },
		},
	], { x: 100, y: 120 })).toBeNull();
	expect(pickShelfContentRowAtScreen([
		{
			row,
			index: 0,
			visible: true,
			renderOrder: 1,
			bounds: { minX: 100, minY: 100, maxX: 200, maxY: 100 },
		},
	], { x: 120, y: 100 })).toBeNull();
});

test("pickShelfContentRowAtScreen ignores non-finite row bounds and pointer", () => {
	const row = { id: "row", name: "Row" };
	const validRow = {
		row,
		index: 0,
		visible: true,
		renderOrder: 1,
		bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
	};

	expect(pickShelfContentRowAtScreen([
		{
			...validRow,
			bounds: { minX: Number.NaN, minY: 100, maxX: 200, maxY: 160 },
		},
	], { x: 120, y: 120 })).toBeNull();
	expect(pickShelfContentRowAtScreen([
		{
			...validRow,
			bounds: { minX: 100, minY: 100, maxX: Number.POSITIVE_INFINITY, maxY: 160 },
		},
	], { x: 120, y: 120 })).toBeNull();
	expect(pickShelfContentRowAtScreen([validRow], { x: Number.NaN, y: 120 })).toBeNull();
	expect(pickShelfContentRowAtScreen([validRow], { x: 120, y: Number.POSITIVE_INFINITY })).toBeNull();
});

test("screenContainsShelfContentPanel uses baseline 42px padding", () => {
	const panel = {
		visible: true,
		bounds: { minX: 300, minY: 200, maxX: 500, maxY: 520 },
	};

	expect(screenContainsShelfContentPanel(panel, { x: 258, y: 158 })).toBe(true);
	expect(screenContainsShelfContentPanel(panel, { x: 257, y: 158 })).toBe(false);
	expect(screenContainsShelfContentPanel(panel, { x: 258, y: 563 })).toBe(false);
});

test("screenContainsShelfContentPanel ignores zero-area and non-finite bounds", () => {
	expect(screenContainsShelfContentPanel({
		visible: true,
		bounds: { minX: 300, minY: 200, maxX: 300, maxY: 520 },
	}, { x: 300, y: 240 })).toBe(false);
	expect(screenContainsShelfContentPanel({
		visible: true,
		bounds: { minX: 300, minY: 200, maxX: 500, maxY: 200 },
	}, { x: 320, y: 200 })).toBe(false);
	expect(screenContainsShelfContentPanel({
		visible: true,
		bounds: { minX: Number.NaN, minY: 200, maxX: 500, maxY: 520 },
	}, { x: 320, y: 240 })).toBe(false);
	expect(screenContainsShelfContentPanel({
		visible: true,
		bounds: { minX: 300, minY: 200, maxX: Number.POSITIVE_INFINITY, maxY: 520 },
	}, { x: 320, y: 240 })).toBe(false);
});

test("shelf content screen hit primitives export baseline default geometry and padding constants", () => {
	expect(SHELF_CONTENT_ROW_SCREEN_WIDTH).toBe(2.50);
	expect(SHELF_CONTENT_ROW_SCREEN_HEIGHT).toBe(0.36);
	expect(SHELF_CONTENT_ROW_SCREEN_PAD_X).toBe(24);
	expect(SHELF_CONTENT_ROW_SCREEN_PAD_Y).toBe(16);
	expect(SHELF_CONTENT_PANEL_SCREEN_WIDTH).toBe(2.62);
	expect(SHELF_CONTENT_PANEL_SCREEN_HEIGHT).toBe(3.02);
	expect(SHELF_CONTENT_PANEL_SCREEN_PAD).toBe(42);
});

test("ShelfContentList defaults to no screen targets", () => {
	const list = createShelfContentList();

	expect(list.pickRowAtScreen({ x: 120, y: 120 })).toBeNull();
	expect(list.screenContainsPanel({ x: 120, y: 120 })).toBe(false);
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(false);
});

test("ShelfContentList picks rows from stored screen targets using baseline row hit behavior", () => {
	const list = createShelfContentList();
	const low = { id: "low", name: "Low" };
	const high = { id: "high", name: "High" };

	list.setScreenTargets({
		rows: [
			{
				row: low,
				index: 1,
				visible: true,
				renderOrder: 10,
				bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
			},
			{
				row: high,
				index: 7,
				visible: true,
				renderOrder: 20,
				bounds: { minX: 110, minY: 110, maxX: 210, maxY: 170 },
			},
		],
	});

	expect(list.pickRowAtScreen({ x: 90, y: 100 })).toEqual({
		row: high,
		index: 7,
		uv: { x: 0, y: 1 },
		screenPick: true,
	});
	expect(list.hasScreenTargetAt({ x: 90, y: 100 })).toBe(true);
});

test("ShelfContentList checks stored panel targets after row targets", () => {
	const list = createShelfContentList();
	const row = { id: "row", name: "Row" };

	list.setScreenTargets({
		rows: [
			{
				row,
				index: 0,
				visible: true,
				renderOrder: 1,
				bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
			},
		],
		panel: {
			visible: true,
			bounds: { minX: 300, minY: 200, maxX: 500, maxY: 520 },
		},
	});

	expect(list.screenContainsPanel({ x: 258, y: 158 })).toBe(true);
	expect(list.hasScreenTargetAt({ x: 258, y: 158 })).toBe(true);
	expect(list.pickRowAtScreen({ x: 120, y: 120 })?.row).toBe(row);
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(true);
});

test("ShelfContentList can clear stored screen targets", () => {
	const list = createShelfContentList();

	list.setScreenTargets({
		rows: [
			{
				row: { id: "row", name: "Row" },
				index: 0,
				visible: true,
				renderOrder: 1,
				bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
			},
		],
		panel: {
			visible: true,
			bounds: { minX: 300, minY: 200, maxX: 500, maxY: 520 },
		},
	});

	list.clearScreenTargets();

	expect(list.pickRowAtScreen({ x: 120, y: 120 })).toBeNull();
	expect(list.screenContainsPanel({ x: 320, y: 240 })).toBe(false);
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(false);
});

test("ShelfContentList screen hit methods can be used as callbacks", () => {
	const list = createShelfContentList();
	list.setScreenTargets({
		rows: [
			{
				row: { id: "row", name: "Row" },
				index: 0,
				visible: true,
				renderOrder: 1,
				bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
			},
		],
	});

	const hasScreenTargetAt = list.hasScreenTargetAt;

	expect(hasScreenTargetAt({ x: 120, y: 120 })).toBe(true);
});

test("ShelfContentList clears stale screen targets when content state changes", () => {
	const list = createShelfContentList();
	const setTargets = () => list.setScreenTargets({
		rows: [
			{
				row: { id: "row", name: "Row" },
				index: 0,
				visible: true,
				renderOrder: 1,
				bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 },
			},
		],
		panel: {
			visible: true,
			bounds: { minX: 300, minY: 200, maxX: 500, maxY: 520 },
		},
	});

	setTargets();
	list.open({ playlistId: "p1", title: "A" });
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(false);

	setTargets();
	list.setRows(makeRows(2));
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(false);

	setTargets();
	list.setLoading();
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(false);

	setTargets();
	list.setError("歌单加载失败");
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(false);

	setTargets();
	list.close();
	expect(list.hasScreenTargetAt({ x: 120, y: 120 })).toBe(false);
	expect(list.screenContainsPanel({ x: 320, y: 240 })).toBe(false);
});

test("ShelfContentList copies caller screen target arrays and bounds", () => {
	const list = createShelfContentList();
	const firstBounds = { minX: 100, minY: 100, maxX: 200, maxY: 160 };
	const callerRows = [
		{
			row: { id: "first", name: "First" },
			index: 0,
			visible: true,
			renderOrder: 1,
			bounds: firstBounds,
		},
	];

	list.setScreenTargets({ rows: callerRows });
	callerRows.push({
		row: { id: "pushed", name: "Pushed" },
		index: 1,
		visible: true,
		renderOrder: 99,
		bounds: { minX: 300, minY: 300, maxX: 360, maxY: 340 },
	});
	firstBounds.minX = 500;

	expect(list.pickRowAtScreen({ x: 120, y: 120 })?.row.id).toBe("first");
	expect(list.pickRowAtScreen({ x: 320, y: 320 })).toBeNull();
});
