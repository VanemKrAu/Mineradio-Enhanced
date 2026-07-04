import { useEffect, useState, type ReactElement } from "react";
import { getRuntimeConfig } from "../../tauri/runtime";

export interface AboutHostProps {
	open: boolean;
	onClose: () => void;
}

export function AboutHost({ open, onClose }: AboutHostProps): ReactElement | null {
	const [version, setVersion] = useState("0.0.0-dev");

	useEffect(() => {
		if (!open) return;
		getRuntimeConfig()
			.then((cfg) => setVersion(cfg.appVersion))
			.catch(() => {});
	}, [open]);

	if (!open) return null;

	return (
		<div
			id="about-modal"
			className="modal-mask show"
			role="presentation"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="about-dialog" role="dialog" aria-modal="true" aria-label="关于">
				<button className="about-close-btn" type="button" onClick={onClose} aria-label="关闭">
					<svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16">
						<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" fill="none" />
					</svg>
				</button>
				<div className="about-logo" aria-hidden="true">
					<svg viewBox="0 0 72 72" width="72" height="72" fill="none">
						<rect width="72" height="72" rx="18" fill="var(--fc-accent, #00f5d4)" fillOpacity="0.15" />
						<text x="36" y="46" textAnchor="middle" fill="var(--fc-accent, #00f5d4)" fontSize="28" fontWeight="800" fontFamily="system-ui, sans-serif">M</text>
					</svg>
				</div>
				<div className="about-name">MineRadio-Tauri</div>
				<div className="about-version">v{version}</div>
				<div className="about-desc">
					基于 Mineradio 的 Tauri 重构版，正在持续移植中。
				</div>
				<div className="about-badge">🎛 系统媒体控件 · Tauri</div>
				<div className="about-links">
					<a
						className="about-link"
						href="https://github.com/VanemKrAu/Mineradio-Plus"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub · VanemKrAu/Mineradio-Plus
					</a>
					<a
						className="about-link"
						href="https://github.com/XxHuberrr/Mineradio"
						target="_blank"
						rel="noopener noreferrer"
					>
						原版 · XxHuberrr/Mineradio
					</a>
				</div>
				<div className="about-footer">
					本增强版为个人修改版，仅根据个人使用习惯和审美进行调整，非官方发布。
					<br />
					Licensed under GPL-3.0
				</div>
			</div>
		</div>
	);
}
