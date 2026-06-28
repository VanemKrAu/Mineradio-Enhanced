import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { EmptyHomeHost } from "./EmptyHomeHost";

test("EmptyHomeHost renders the baseline empty-home music landing structure", () => {
	const html = renderToStaticMarkup(React.createElement(EmptyHomeHost));
	expect(html).toContain('id="empty-home"');
	expect(html).toContain("🚧此处施工，敬请期待🚧");
	expect(html).toContain("展开播放器控制台");
	expect(html).toContain('class="home-grid"');
	expect(html).toContain("我的歌单");
	expect(html).toContain("每日推荐");
	expect(html).toContain("私人电台");
	expect(html).toContain('id="home-tile-row"');
	expect(html).toContain('class="home-tile-action"');
});

test("EmptyHomeHost routes the private radio card to the weather radio starter", async () => {
	await import("../../../../packages/visual-engine/src/runtime/happy-dom-preload");
	const calls: string[] = [];
	const host = document.createElement("div");
	document.body.appendChild(host);
	const root = createRoot(host);

	flushSync(() => root.render(<EmptyHomeHost onStartWeatherRadio={() => calls.push("start")} />));
	(host.querySelector('[data-home-radio-start="true"]') as HTMLButtonElement).click();

	expect(calls).toEqual(["start"]);
	root.unmount();
	host.remove();
});
