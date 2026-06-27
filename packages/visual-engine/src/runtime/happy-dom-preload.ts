import { Window } from "happy-dom";

const dom = new Window();
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom;
g.document = dom.document;
g.HTMLElement = dom.HTMLElement;
g.Element = dom.Element;
g.Node = dom.Node;
g.customElements = dom.customElements;
g.requestAnimationFrame = dom.requestAnimationFrame as unknown as typeof requestAnimationFrame;
g.cancelAnimationFrame = dom.cancelAnimationFrame as unknown as typeof cancelAnimationFrame;
g.performance = (dom.performance ?? { now: () => Date.now() }) as Performance;

export {};