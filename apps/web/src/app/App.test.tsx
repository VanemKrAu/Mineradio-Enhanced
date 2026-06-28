import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { App } from "./App";

test("App keeps the empty-home music page mounted behind the splash gate", () => {
	const html = renderToStaticMarkup(React.createElement(App));
	expect(html).toContain('class="visual-splash-root"');
	expect(html).toContain('id="visual-host"');
	expect(html).toContain('id="empty-home"');
	expect(html).toContain("我的音乐库");
	expect(html).toContain("每日推荐");
});
