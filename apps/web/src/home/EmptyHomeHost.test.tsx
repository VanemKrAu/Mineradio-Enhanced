import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { EmptyHomeHost } from "./EmptyHomeHost";

test("EmptyHomeHost renders the baseline empty-home music landing structure", () => {
	const html = renderToStaticMarkup(React.createElement(EmptyHomeHost));
	expect(html).toContain('id="empty-home"');
	expect(html).toContain("Mineradio · Your Library");
	expect(html).toContain("我的音乐库");
	expect(html).toContain("每日推荐");
	expect(html).toContain("私人电台");
	expect(html).toContain('id="home-tile-row"');
});
