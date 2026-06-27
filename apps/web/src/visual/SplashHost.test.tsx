import { expect, test, beforeEach, afterEach } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { createSplashEngine, SPLASH_CSS } from "@mineradio/visual-engine";
import { SplashHost } from "./SplashHost";

type FakeEl = {
	tag: string;
	id: string;
	className: string;
	innerHTML: string;
	textContent: string;
	attrs: Map<string, string>;
	style: Record<string, string>;
	classList: { add: (...t: string[]) => void; remove: (...t: string[]) => void; contains: (t: string) => boolean };
	children: FakeEl[];
	parentNode: FakeEl | null;
	getContext(): null;
	setAttribute(k: string, v: string): void;
	getAttribute(k: string): string | null;
	querySelector(sel: string): FakeEl | null;
	querySelectorAll(sel: string): FakeEl[];
	appendChild(c: FakeEl): FakeEl;
	removeChild(c: FakeEl): FakeEl;
	addEventListener(): void;
	removeEventListener(): void;
};

interface FakeWindow {
	innerWidth: number;
	innerHeight: number;
	devicePixelRatio: number;
	addEventListener(): void;
	removeEventListener(): void;
}

interface FakeDocument {
	head: FakeEl;
	body: FakeEl;
	createElement(tag: string): FakeEl;
	getElementById(id: string): FakeEl | null;
}

const saved = {
	window: globalThis.window as unknown,
	document: globalThis.document as unknown,
	performance: globalThis.performance as unknown,
	requestAnimationFrame: globalThis.requestAnimationFrame,
	cancelAnimationFrame: globalThis.cancelAnimationFrame,
	setTimeout: globalThis.setTimeout,
	clearTimeout: globalThis.clearTimeout,
};

let fakeRoot: FakeEl;
let fakeHead: FakeEl;
let fakeBody: FakeEl;
let timedOut: Array<{ fn: () => void; delay: number }> = [];
let rafCount = 0;

function makeEl(tag: string): FakeEl {
	const cls = new Set<string>();
	const attrs = new Map<string, string>();
	let rawInnerHTML = "";
	let rawTextContent = "";
	let idCache = "";
	const el: FakeEl = {
		tag,
		id: "",
		className: "",
		innerHTML: "",
		textContent: "",
		attrs,
		style: {},
		classList: {
			add: (...tokens: string[]) => tokens.forEach((t) => cls.add(t)),
			remove: (...tokens: string[]) => tokens.forEach((t) => cls.delete(t)),
			contains: (t: string) => cls.has(t),
		},
		children: [],
		parentNode: null,
		getContext: () => null,
		setAttribute: (k: string, v: string) => {
			attrs.set(k, v);
			if (k === "id") idCache = v;
		},
		getAttribute: (k: string) => attrs.get(k) ?? null,
		querySelector: (sel: string) => findFirst(el, sel),
		querySelectorAll: (sel: string) => findAll(el, sel),
		appendChild: (c: FakeEl) => {
			el.children.push(c);
			c.parentNode = el;
			return c;
		},
		removeChild: (c: FakeEl) => {
			const i = el.children.indexOf(c);
			if (i >= 0) el.children.splice(i, 1);
			c.parentNode = null;
			return c;
		},
		addEventListener: () => {},
		removeEventListener: () => {},
	};
	Object.defineProperty(el, "id", {
		get() {
			return idCache;
		},
		set(v: string) {
			idCache = v;
			attrs.set("id", v);
		},
		configurable: true,
	});
	Object.defineProperty(el, "innerHTML", {
		get() {
			return rawInnerHTML;
		},
		set(v: string) {
			rawInnerHTML = v;
			el.children.length = 0;
			parseInnerHTML(el, v);
		},
		configurable: true,
	});
	Object.defineProperty(el, "textContent", {
		get() {
			return rawTextContent;
		},
		set(v: string) {
			rawTextContent = v;
		},
		configurable: true,
	});
	return el;
}

function matches(el: FakeEl, sel: string): boolean {
	if (sel.startsWith("#")) return (el.attrs.get("id") ?? "") === sel.slice(1);
	if (sel.startsWith(".")) {
		const cls = el.className.split(/\s+/);
		return cls.includes(sel.slice(1));
	}
	return el.tag === sel;
}

function findFirst(root: FakeEl, sel: string): FakeEl | null {
	for (const c of root.children) {
		if (matches(c, sel)) return c;
		const sub = findFirst(c, sel);
		if (sub) return sub;
	}
	return null;
}

function findAll(root: FakeEl, sel: string, acc: FakeEl[] = []): FakeEl[] {
	for (const c of root.children) {
		if (matches(c, sel)) acc.push(c);
		findAll(c, sel, acc);
	}
	return acc;
}

function parseInnerHTML(parent: FakeEl, html: string): void {
	const tagRe = /<\/?([a-zA-Z][\w-]*)([^>]*)>/g;
	const stack: FakeEl[] = [parent];
	let m: RegExpExecArray | null;
	while ((m = tagRe.exec(html)) !== null) {
		const full = m[0];
		const closing = full.startsWith("</");
		const tag = m[1];
		const attrStr = m[2] ?? "";
		if (closing) {
			stack.pop();
			continue;
		}
		const el = makeEl(tag);
		const attrRe = /([\w-]+)\s*=\s*"([^"]*)"/g;
		let am: RegExpExecArray | null;
		while ((am = attrRe.exec(attrStr)) !== null) {
			el.setAttribute(am[1]!, am[2]!);
			if (am[1] === "class") el.className = am[2]!;
		}
		const top = stack[stack.length - 1]!;
		top.appendChild(el);
		const selfClose = full.endsWith("/>");
		if (!selfClose) stack.push(el);
	}
}

class FakeClassListForBody {
	classes = new Set<string>();
	add(...t: string[]) {
		t.forEach((x) => this.classes.add(x));
	}
	remove(...t: string[]) {
		t.forEach((x) => this.classes.delete(x));
	}
	contains(t: string) {
		return this.classes.has(t);
	}
}

beforeEach(() => {
	fakeHead = makeEl("head");
	fakeBody = makeEl("body");
	fakeRoot = makeEl("div");
	timedOut = [];
	rafCount = 0;

	const fakeDocument: FakeDocument = {
		head: fakeHead,
		body: fakeBody,
		createElement: (tag: string) => {
			const el = makeEl(tag);
			return el;
		},
		getElementById: (id: string) => {
			const all: FakeEl[] = [fakeHead, fakeBody];
			const find = (root: FakeEl): FakeEl | null => {
				for (const c of root.children) {
					if ((c.attrs.get("id") ?? "") === id) return c;
					all.push(c);
					const f = find(c);
					if (f) return f;
				}
				return null;
			};
			for (const r of all) {
				if ((r.attrs.get("id") ?? "") === id) return r;
				const f = find(r);
				if (f) return f;
			}
			return null;
		},
	};

	Object.defineProperty(fakeBody, "classList", {
		value: new FakeClassListForBody(),
		configurable: true,
	});

	Object.defineProperty(fakeHead, "classList", {
		value: new FakeClassListForBody(),
		configurable: true,
	});

	const fakeWindow: FakeWindow = {
		innerWidth: 1280,
		innerHeight: 720,
		devicePixelRatio: 1,
		addEventListener: () => {},
		removeEventListener: () => {},
	};

	Object.defineProperty(makeEl, "name", { value: "makeEl" });

	(globalThis as Record<string, unknown>).document = fakeDocument;
	(globalThis as Record<string, unknown>).window = fakeWindow;
	(globalThis as Record<string, unknown>).performance = { now: () => 1000 } as Performance;
	(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: (t: number) => void): number => {
		rafCount += 1;
		const id = rafCount;
		timedOut.push({ fn: () => cb(1000 + id), delay: 0 });
		return id;
	};
	(globalThis as Record<string, unknown>).cancelAnimationFrame = () => {};
	(globalThis as Record<string, unknown>).setTimeout = (fn: () => void, delay = 0): number => {
		timedOut.push({ fn, delay });
		return timedOut.length;
	};
	(globalThis as Record<string, unknown>).clearTimeout = () => {};

	void SPLASH_CSS;
});

afterEach(() => {
	(globalThis as Record<string, unknown>).document = saved.document;
	(globalThis as Record<string, unknown>).window = saved.window;
	(globalThis as Record<string, unknown>).performance = saved.performance;
	(globalThis as Record<string, unknown>).requestAnimationFrame = saved.requestAnimationFrame;
	(globalThis as Record<string, unknown>).cancelAnimationFrame = saved.cancelAnimationFrame;
	(globalThis as Record<string, unknown>).setTimeout = saved.setTimeout;
	(globalThis as Record<string, unknown>).clearTimeout = saved.clearTimeout;
});

function flushTimers(): void {
	const queue = timedOut.slice();
	timedOut.length = 0;
	for (const t of queue) t.fn();
}

function asHtml(el: FakeEl): HTMLElement {
	return el as unknown as HTMLElement;
}

test("SplashHost server-renders a visual-splash-root div", () => {
	const html = renderToStaticMarkup(React.createElement(SplashHost, {}));
	expect(html).toContain("visual-splash-root");
});

test("createSplashEngine builds splash DOM inside root and fires ready callback via timer", () => {
	let readyCalled = 0;
	const engine = createSplashEngine(asHtml(fakeRoot), {
		onReadyToEnter: () => {
			readyCalled += 1;
		},
	});
	expect(fakeRoot.children.length).toBeGreaterThan(0);
	const splash = fakeRoot.children[0]!;
	expect(splash.tag).toBe("div");
	expect(splash.attrs.get("id")).toBe("splash");
	const canvas = splash.querySelector("#splash-canvas");
	expect(canvas).not.toBeNull();
	expect(canvas!.tag).toBe("canvas");
	expect(splash.querySelector(".splash-wordmark")).not.toBeNull();
	expect(splash.querySelector(".splash-enter")).not.toBeNull();

	flushTimers();
	expect(readyCalled).toBe(1);
	expect(splash.classList.contains("ready")).toBe(true);
	expect(splash.attrs.get("aria-label")).toBe("点击进入 Mineradio");

	engine.dispose();
	expect(fakeRoot.children.length).toBe(0);
});

test("createSplashEngine uses Canvas fallback when WebGL returns null", () => {
	const engine = createSplashEngine(asHtml(fakeRoot), {});
	const splash = fakeRoot.children[0]!;
	expect(splash.querySelector("#splash-canvas")).not.toBeNull();
	flushTimers();
	engine.dismiss();
	flushTimers();
	expect(splash.classList.contains("exiting")).toBe(true);
	engine.dispose();
});

test("createSplashEngine dismiss fires onDismissed after final timer", () => {
	let dismissed = 0;
	const engine = createSplashEngine(asHtml(fakeRoot), {
		onDismissed: () => {
			dismissed += 1;
		},
	});
	engine.dismiss();
	flushTimers();
	expect(dismissed).toBe(1);
	engine.dispose();
});