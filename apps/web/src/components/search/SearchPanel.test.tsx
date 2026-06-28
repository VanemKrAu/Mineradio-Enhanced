import { expect, test, beforeEach, afterEach } from "bun:test";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchPanel } from "./SearchPanel";
import { SidecarClient } from "../../api/sidecar-client";
import { useSearchStore } from "../../stores/search-store";
import { usePlaybackStore } from "../../stores/playback-store";
import { playSearchResult, isPlayable } from "./play-search-result";
import type { ProviderId, Track } from "@mineradio/shared";

const BASE = "http://127.0.0.1:65535";

let originalUseSyncExternalStore: typeof React.useSyncExternalStore;
let domRoot: HTMLElement | null = null;

beforeEach(() => {
	originalUseSyncExternalStore = React.useSyncExternalStore;
	React.useSyncExternalStore = ((
		subscribe: (listener: () => void) => () => void,
		getSnapshot: () => unknown,
		getServerSnapshot?: () => unknown,
	) => {
		const snap = (getServerSnapshot ?? getSnapshot).bind(null);
		void snap;
		return originalUseSyncExternalStore(
			subscribe as (listener: () => void) => () => void,
			getSnapshot as () => unknown,
			getSnapshot as () => unknown,
		);
	}) as typeof React.useSyncExternalStore;
});

afterEach(() => {
	React.useSyncExternalStore = originalUseSyncExternalStore;
	domRoot?.remove();
	domRoot = null;
});

function makeTrack(id: string, title: string, playableState: Track["playableState"] = "playable"): Track {
	return {
		provider: "netease",
		id,
		sourceId: id,
		title,
		artists: ["Artist"],
		album: "Album",
		coverUrl: "",
		qualityHints: [],
		playableState,
	};
}

function resetStores(): void {
	useSearchStore.setState({
		results: [],
		loading: false,
		error: null,
		provider: "netease",
		keyword: "",
	});
	usePlaybackStore.setState({
		currentTrack: null,
		isPlaying: false,
		positionMs: 0,
		durationMs: null,
		mode: "queue",
		queue: [],
	});
}

async function renderPanelInDom(client: SidecarClient): Promise<{ root: Root; container: HTMLElement }> {
	if (typeof document === "undefined") {
		await import("../../../../../packages/visual-engine/src/runtime/happy-dom-preload");
	}
	domRoot = document.createElement("div");
	document.body.appendChild(domRoot);
	const root = createRoot(domRoot);
	flushSync(() => root.render(<SearchPanel client={client} />));
	await Promise.resolve();
	return { root, container: domRoot };
}

async function submitSearchForm(container: HTMLElement): Promise<void> {
	const form = container.querySelector<HTMLFormElement>(".search-form");
	expect(form).not.toBeNull();
	const EventCtor = document.defaultView?.Event ?? Event;
	form!.dispatchEvent(new EventCtor("submit", { bubbles: true, cancelable: true }));
	await Promise.resolve();
}

test("SearchPanel renders provided results and disables buttons for non-playable states", () => {
	resetStores();
	const tracks = [makeTrack("a", "A"), makeTrack("b", "B", "vip_required")];
	useSearchStore.getState().setResults(tracks);
	const html = renderToStaticMarkup(
		<SearchPanel client={new SidecarClient(BASE)} />,
	);
	expect(html).toContain('data-track-id="a"');
	expect(html).toContain('data-track-id="b"');
	expect(html).toContain('data-disabled="true"');
	expect(html).toContain('data-playable-state="vip_required"');
});

test("SearchPanel enables QQ search UI after sidecar QQ provider landed", () => {
	resetStores();
	useSearchStore.getState().setProvider("qq");
	const html = renderToStaticMarkup(
		<SearchPanel client={new SidecarClient(BASE)} />,
	);
	expect(html).toContain('data-provider="qq"');
	expect(html).not.toContain("QQ provider 不在 P4.5 接入范围");
	expect(html).toContain('<button type="submit" class="search-submit">搜索</button>');
});

test("SearchPanel submits QQ searches through the sidecar client", async () => {
	resetStores();
	useSearchStore.getState().setProvider("qq");
	useSearchStore.getState().setKeyword("夜航星");
	const calls: Array<{ provider: ProviderId; keyword: string; limit: number }> = [];
	const client = {
		search: async (provider: ProviderId, keyword: string, limit: number) => {
			calls.push({ provider, keyword, limit });
			return [makeTrack("qq-1", "QQ Track")];
		},
	} as SidecarClient;
	const { root, container } = await renderPanelInDom(client);
	await submitSearchForm(container);
	await Promise.resolve();
	root.unmount();

	expect(calls).toEqual([{ provider: "qq", keyword: "夜航星", limit: 30 }]);
	expect(useSearchStore.getState().results[0]?.title).toBe("QQ Track");
});

test("playSearchResult enqueues and plays the clicked track", () => {
	resetStores();
	const tracks = [makeTrack("a", "A"), makeTrack("b", "B")];
	playSearchResult(tracks[1]);
	expect(usePlaybackStore.getState().queue.length).toBe(1);
	expect(usePlaybackStore.getState().currentTrack?.id).toBe("b");
});

test("playSearchResult on second track advances currentTrack", () => {
	resetStores();
	const tracks = [makeTrack("a", "A"), makeTrack("b", "B")];
	usePlaybackStore.getState().setQueue(tracks);
	playSearchResult(tracks[1]);
	expect(usePlaybackStore.getState().queue.length).toBeGreaterThanOrEqual(2);
	expect(usePlaybackStore.getState().currentTrack?.id).toBe("b");
});

test("isPlayable returns false only for hard-disabled states", () => {
	expect(isPlayable("unavailable")).toBe(false);
	expect(isPlayable("paid_required")).toBe(false);
	expect(isPlayable("vip_required")).toBe(false);
	expect(isPlayable("login_required")).toBe(false);
	expect(isPlayable("playable")).toBe(true);
	expect(isPlayable("trial_only")).toBe(true);
	expect(isPlayable("unknown")).toBe(true);
});
