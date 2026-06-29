import { type ReactElement, type ReactNode } from "react";

export interface TopRightControlsProps {
	onHome?: () => void;
	onLogin?: () => void;
	onGuide?: () => void;
	onHideCapsule?: () => void;
	capsuleAutoHide?: boolean;
	loggedIn?: boolean;
	accountLabel?: string;
	updateSlot?: ReactNode;
}

export function TopRightControls({
	onHome,
	onLogin,
	onGuide,
	onHideCapsule,
	capsuleAutoHide = false,
	loggedIn = false,
	accountLabel,
	updateSlot,
}: TopRightControlsProps): ReactElement {
	const capsuleTitle = capsuleAutoHide ? "取消自动隐藏账号胶囊" : "自动隐藏账号胶囊";
	return (
		<div id="top-right">
			<button
				id="user-capsule-hide-btn"
				className={capsuleAutoHide ? "user-capsule-hide-btn on" : "user-capsule-hide-btn"}
				type="button"
				onClick={onHideCapsule}
				title={capsuleTitle}
				aria-label={capsuleTitle}
				aria-pressed={capsuleAutoHide}
			>
				{capsuleAutoHide ? "›" : "‹"}
			</button>
			<button
				id="visual-guide-btn"
				className="icon-btn"
				type="button"
				onClick={onGuide}
				title="查看使用引导"
				aria-label="查看使用引导"
			>
				?
			</button>
			<button
				id="home-btn"
				className="icon-btn"
				type="button"
				onClick={onHome}
				title="回到 Home"
				aria-label="回到 Home"
			>
				<svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M3 10.8 12 3l9 7.8" />
					<path d="M5 10v10h14V10" />
					<path d="M9.5 20v-5h5v5" />
				</svg>
			</button>
			<button id="user-btn" className={loggedIn ? "icon-btn logged-in" : "icon-btn logged-out"} type="button" onClick={onLogin} title={loggedIn ? "账号信息" : "登录账号"} aria-label={loggedIn ? "账号信息" : "登录账号"}>
				<span className="login-word">{loggedIn ? (accountLabel ?? "已登录") : "登录"}</span>
			</button>
			{updateSlot}
		</div>
	);
}
