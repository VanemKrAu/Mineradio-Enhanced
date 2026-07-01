import { type ReactElement } from "react";
import type { ProviderVipIcon } from "@mineradio/shared";

export interface TopRightControlsProps {
	onHome?: () => void;
	onLogin?: () => void;
	onHideCapsule?: () => void;
	capsuleAutoHide?: boolean;
	loggedIn?: boolean;
	accountLabel?: string;
	accountAvatarUrl?: string;
	accountVipLevel?: "none" | "vip" | "svip";
	accountVipLabel?: string;
	accountVipIcon?: ProviderVipIcon;
	accountVipIconUrl?: string;
}

function vipBadgeText(level?: "none" | "vip" | "svip", label?: string): string {
	const trimmedLabel = label?.trim();
	if (trimmedLabel) return trimmedLabel;
	if (level === "svip") return "SVIP";
	if (level === "vip") return "VIP";
	return "";
}

function vipBadgeClassName(icon?: ProviderVipIcon): string {
	return icon ? `user-vip-tag ${icon}` : "user-vip-tag";
}

function VipBadgeFallbackIcon({ icon }: { icon?: ProviderVipIcon }): ReactElement {
	if (icon === "qq-green-vip") {
		return (
			<svg className="user-vip-icon user-vip-svg" viewBox="0 0 16 16" aria-hidden="true">
				<path className="vip-gem-top" d="M4.3 2.5h7.4l2.1 3.1L8 14 2.2 5.6z" />
				<path className="vip-gem-cut" d="M4.3 2.5 8 14l3.7-11.5M2.2 5.6h11.6M5.7 5.6 8 2.5l2.3 3.1" />
			</svg>
		);
	}
	if (icon === "qq-super-vip") {
		return (
			<svg className="user-vip-icon user-vip-svg" viewBox="0 0 16 16" aria-hidden="true">
				<path className="vip-crown-fill" d="M2.1 5.2 5.1 7l2.9-4 2.9 4 3-1.8-1.1 7.2H3.2z" />
				<path className="vip-crown-line" d="M2.1 5.2 5.1 7l2.9-4 2.9 4 3-1.8-1.1 7.2H3.2zM3.7 13.5h8.6" />
			</svg>
		);
	}
	return (
		<svg className="user-vip-icon user-vip-svg" viewBox="0 0 16 16" aria-hidden="true">
			<circle className="vip-disc-outer" cx="8" cy="8" r="6.1" />
			<circle className="vip-disc-ring" cx="8" cy="8" r="3.3" />
			<circle className="vip-disc-hole" cx="8" cy="8" r="1.15" />
			<path className="vip-disc-shine" d="M5 4.3A5.2 5.2 0 0 1 8 3" />
		</svg>
	);
}

export interface VipBadgeProps {
	id?: string;
	text: string;
	icon?: ProviderVipIcon;
	iconUrl?: string;
}

export function VipBadge({ id, text, icon, iconUrl }: VipBadgeProps): ReactElement {
	if (iconUrl) {
		return (
			<span id={id} className={`${vipBadgeClassName(icon)} official-icon-only`} title={text} aria-label={text}>
				<img className="user-vip-icon user-vip-icon-img" src={iconUrl} alt="" aria-hidden="true" />
			</span>
		);
	}
	return (
		<span id={id} className={vipBadgeClassName(icon)}>
			<VipBadgeFallbackIcon icon={icon} />
			<span className="user-vip-text">{text}</span>
		</span>
	);
}

export function TopRightControls({
	onHome,
	onLogin,
	onHideCapsule,
	capsuleAutoHide = false,
	loggedIn = false,
	accountLabel,
	accountAvatarUrl,
	accountVipLevel,
	accountVipLabel,
	accountVipIcon,
	accountVipIconUrl,
}: TopRightControlsProps): ReactElement {
	const capsuleTitle = capsuleAutoHide ? "取消自动隐藏账号胶囊" : "自动隐藏账号胶囊";
	const vipText = loggedIn ? vipBadgeText(accountVipLevel, accountVipLabel) : "";
	const initial = (accountLabel ?? "已").trim().slice(0, 1) || "已";
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
				{loggedIn && accountAvatarUrl ? (
					<img id="user-avatar" className="user-avatar" src={accountAvatarUrl} alt="" aria-hidden="true" />
				) : loggedIn ? (
					<span id="user-avatar-fallback" className="user-avatar fallback" aria-hidden="true">{initial}</span>
				) : null}
				<span className="user-account-main">
					<span className="login-word">{loggedIn ? (accountLabel ?? "已登录") : "登录"}</span>
					{vipText ? (
						<VipBadge id="user-vip-tag" text={vipText} icon={accountVipIcon} iconUrl={accountVipIconUrl} />
					) : null}
				</span>
			</button>
		</div>
	);
}
