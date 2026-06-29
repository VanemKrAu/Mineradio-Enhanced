import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactElement } from "react";

export const VISUAL_GUIDE_SEEN_STORE_KEY = "mineradio-visual-guide-seen-v2";

export interface VisualGuideStep {
	selector?: string;
	target?: "stage" | "shelf";
	kicker: string;
	title: string;
	body: string;
}

export interface VisualGuideHostProps {
	open: boolean;
	onClose: (markSeen: boolean) => void;
	onPrepareStep?: (step: VisualGuideStep) => void;
}

const VISUAL_GUIDE_STEPS: VisualGuideStep[] = [
	{
		target: "stage",
		kicker: "01 / Welcome",
		title: "Mineradio 是用来听歌的视觉播放器",
		body: "它不是单纯歌单页：搜索或导入一首歌后，封面、歌词、粒子和镜头会跟着音乐一起动。",
	},
	{
		selector: "#search-box",
		kicker: "02 / Play",
		title: "从搜索或导入开始",
		body: "输入歌名、歌手或关键词即可播放；如果有本地音乐，也可以用导入入口直接放进舞台。",
	},
	{
		selector: "#bottom-bar",
		kicker: "03 / Control",
		title: "播放以后看底部控制台",
		body: "播放、切歌、进度、队列和歌词都集中在底部，先把它当作一个正常播放器使用就可以。",
	},
	{
		selector: "#user-btn",
		kicker: "04 / Account",
		title: "登录只是为了同步你的音乐库",
		body: "登录后会同步歌单、红心和播客；不登录也可以搜索和播放，不会强制卡住你。",
	},
	{
		target: "shelf",
		kicker: "05 / Visual",
		title: "进阶视觉都放在舞台周围",
		body: "右侧 3D 歌单架和 DIY 玩家模式是进阶入口；先播放一首歌，再慢慢调视觉效果。",
	},
	{
		selector: "#fx-fab",
		kicker: "06 / DIY",
		title: "高级功能在视觉控制台",
		body: "视觉控制台、上传/封面、自定义歌词、音质和更多面板都会在这里展开。",
	},
];

function targetRectForStep(step: VisualGuideStep): DOMRect | { left: number; top: number; width: number; height: number; right: number; bottom: number } {
	const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
	const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
	if (step.target === "stage") {
		const width = Math.min(620, Math.max(260, viewportWidth - 72));
		const height = Math.min(310, Math.max(178, viewportHeight * 0.34));
		const left = viewportWidth * 0.5 - width * 0.5;
		const top = Math.max(116, viewportHeight * 0.32 - height * 0.5);
		return { left, top, width, height, right: left + width, bottom: top + height };
	}
	if (step.target === "shelf") {
		const width = Math.max(190, Math.min(320, viewportWidth * 0.24));
		const top = Math.max(136, viewportHeight * 0.22);
		const height = Math.min(390, viewportHeight - top - 142);
		const left = viewportWidth - width;
		return { left, top, width, height, right: viewportWidth, bottom: top + height };
	}
	if (step.selector) {
		const target = document.querySelector(step.selector);
		if (target instanceof HTMLElement) {
			const style = window.getComputedStyle(target);
			const rect = target.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") return rect;
		}
	}
	const width = 240;
	const height = 80;
	const left = viewportWidth * 0.5 - width * 0.5;
	const top = viewportHeight * 0.5 - height * 0.5;
	return { left, top, width, height, right: left + width, bottom: top + height };
}

function setGuidePosition(
	ring: HTMLDivElement | null,
	card: HTMLDivElement | null,
	scrim: HTMLDivElement | null,
	step: VisualGuideStep,
): void {
	if (!ring || !card || typeof window === "undefined") return;
	const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
	const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
	const rect = targetRectForStep(step);
	const pad = step.target === "shelf" ? 14 : step.selector === "#bottom-bar" ? 10 : 8;
	const left = Math.max(12, rect.left - pad);
	const top = Math.max(12, rect.top - pad);
	const width = Math.min(viewportWidth - left - 12, rect.width + pad * 2);
	const height = Math.min(viewportHeight - top - 12, rect.height + pad * 2);
	ring.classList.toggle("shelf-target", step.target === "shelf");
	ring.style.left = `${left}px`;
	ring.style.top = `${top}px`;
	ring.style.width = `${Math.max(44, width)}px`;
	ring.style.height = `${Math.max(38, height)}px`;
	ring.style.borderRadius = step.target === "shelf" ? "28px" : step.selector === "#bottom-bar" ? "20px" : "16px";
	scrim?.style.setProperty("--gx", `${(((rect.left + rect.width / 2) / Math.max(1, viewportWidth)) * 100).toFixed(2)}%`);
	scrim?.style.setProperty("--gy", `${(((rect.top + rect.height / 2) / Math.max(1, viewportHeight)) * 100).toFixed(2)}%`);
	const cardWidth = Math.min(326, viewportWidth - 32);
	const cardHeight = card.offsetHeight || 170;
	let cardLeft = rect.left + rect.width / 2 - cardWidth / 2;
	cardLeft = Math.max(16, Math.min(viewportWidth - cardWidth - 16, cardLeft));
	const below = rect.bottom + 18;
	const above = rect.top - cardHeight - 18;
	const cardTop = below + cardHeight < viewportHeight - 16 ? below : Math.max(16, above);
	card.style.left = `${cardLeft}px`;
	card.style.top = `${cardTop}px`;
}

export function VisualGuideHost({ open, onClose, onPrepareStep }: VisualGuideHostProps): ReactElement {
	const [stepIndex, setStepIndex] = useState(0);
	const ringRef = useRef<HTMLDivElement | null>(null);
	const cardRef = useRef<HTMLDivElement | null>(null);
	const scrimRef = useRef<HTMLDivElement | null>(null);
	const steps = useMemo(() => VISUAL_GUIDE_STEPS, []);
	const step = steps[Math.max(0, Math.min(stepIndex, steps.length - 1))];

	const position = useCallback(() => {
		if (!open) return;
		setGuidePosition(ringRef.current, cardRef.current, scrimRef.current, step);
	}, [open, step]);

	useEffect(() => {
		if (!open) {
			setStepIndex(0);
			return;
		}
		onPrepareStep?.(step);
		const raf = requestAnimationFrame(position);
		const first = window.setTimeout(position, 180);
		const second = window.setTimeout(position, 620);
		return () => {
			cancelAnimationFrame(raf);
			window.clearTimeout(first);
			window.clearTimeout(second);
		};
	}, [onPrepareStep, open, position, step]);

	useEffect(() => {
		if (!open) return;
		window.addEventListener("resize", position);
		window.addEventListener("scroll", position, true);
		return () => {
			window.removeEventListener("resize", position);
			window.removeEventListener("scroll", position, true);
		};
	}, [open, position]);

	const next = useCallback(() => {
		if (stepIndex >= steps.length - 1) {
			onClose(true);
			return;
		}
		setStepIndex((value) => Math.min(steps.length - 1, value + 1));
	}, [onClose, stepIndex, steps.length]);

	const handleSurfaceClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if ((event.target as Element | null)?.closest?.("button")) return;
			event.preventDefault();
			next();
		},
		[next],
	);

	return (
		<div id="visual-guide" className={open ? "show" : ""} aria-live="polite" aria-hidden={!open} onClick={handleSurfaceClick}>
			<div className="visual-guide-scrim" ref={scrimRef} />
			<div id="visual-guide-ring" className="visual-guide-ring" ref={ringRef} />
			<div id="visual-guide-card" className="visual-guide-card" ref={cardRef}>
				<div id="visual-guide-kicker" className="visual-guide-kicker">{step.kicker}</div>
				<div id="visual-guide-title" className="visual-guide-title">{step.title}</div>
				<div id="visual-guide-body" className="visual-guide-body">{step.body}</div>
				<div id="visual-guide-hint" className="visual-guide-hint">{stepIndex === steps.length - 1 ? "点击空白处完成引导" : "点击空白处也可以继续"}</div>
				<div className="visual-guide-actions">
					<button type="button" onClick={() => onClose(true)}>跳过</button>
					<div id="visual-guide-progress" className="visual-guide-progress">{stepIndex + 1} / {steps.length}</div>
					<button id="visual-guide-next" className="primary" type="button" onClick={next}>{stepIndex === steps.length - 1 ? "完成" : "下一步"}</button>
				</div>
			</div>
		</div>
	);
}
