import { type ReactElement } from "react";

export interface EmptyHomeHostProps {
	onSearchFocus?: () => void;
	onOpenLibrary?: () => void;
}

const STARTER_TILES = [
	{ tone: "search", title: "搜索歌曲", sub: "从歌名、歌手或播客开始" },
	{ tone: "local", title: "导入本地", sub: "播放本地音频文件" },
	{ tone: "guide", title: "视觉引导", sub: "熟悉粒子、歌词和歌单架" },
	{ tone: "playlist", title: "打开歌单", sub: "登录后同步你的音乐库" },
	{ tone: "library", title: "继续探索", sub: "推荐会随播放逐步补全" },
];

export function EmptyHomeHost(props: EmptyHomeHostProps): ReactElement {
	return (
		<section id="empty-home" aria-label="Mineradio home">
			<div className="empty-home-shell">
				<div className="home-hero">
					<div className="home-hero-inner home-construction-inner">
						<div className="home-weather-kicker" id="home-weather-kicker">Mineradio · Your Library</div>
						<h1 className="home-title" id="home-weather-title">我的音乐库</h1>
						<p className="home-sub" id="home-subtitle">
							登录后会把你的歌单、常听歌手和最近播放放在这里；也可以直接搜索或导入本地音乐。
						</p>
						<div className="home-weather-meta" id="home-weather-meta">
							<span className="home-weather-pill">正在整理天气</span>
							<span className="home-weather-pill">离线精选</span>
						</div>
						<div className="home-quick-row">
							<button className="home-chip" type="button" onClick={props.onSearchFocus}>搜索音乐</button>
							<button className="home-chip" type="button" onClick={props.onOpenLibrary}>我的歌单</button>
						</div>
					</div>
				</div>

				<button className="home-card" data-home-tone="library" type="button" onClick={props.onOpenLibrary}>
					<div className="home-card-label">Library</div>
					<div className="home-card-title" id="home-weather-card-title">我的歌单</div>
					<div className="home-card-sub" id="home-weather-card-sub">打开左侧歌单库</div>
					<div className="home-card-art" id="home-weather-art" />
				</button>
				<button className="home-card" data-home-tone="mix" type="button" onClick={props.onSearchFocus}>
					<div className="home-card-label">Daily</div>
					<div className="home-card-title" id="home-daily-title">每日推荐</div>
					<div className="home-card-sub" id="home-daily-sub">登录后同步你的今日歌曲</div>
					<div className="home-card-art" id="home-daily-art" />
				</button>
				<button className="home-card" data-home-tone="playlist" type="button" onClick={props.onSearchFocus}>
					<div className="home-card-label">Song</div>
					<div className="home-card-title" id="home-private-title">私人电台</div>
					<div className="home-card-sub" id="home-private-sub">从你的推荐和歌单里开播</div>
					<div className="home-card-art" id="home-private-art" />
				</button>
				<button className="home-card" data-home-tone="mix" type="button" onClick={props.onSearchFocus}>
					<div className="home-card-label">Continue</div>
					<div className="home-card-title" id="home-continue-title">继续听</div>
					<div className="home-card-sub" id="home-continue-sub">最近播放会出现在这里</div>
					<div className="home-card-art" id="home-continue-art" />
				</button>
				<button className="home-card" data-home-tone="local" type="button" onClick={props.onSearchFocus}>
					<div className="home-card-label">Profile</div>
					<div className="home-card-title" id="home-profile-title">听歌画像</div>
					<div className="home-card-sub" id="home-profile-sub">播放几首后生成偏好</div>
					<div className="home-card-art" id="home-profile-art" />
				</button>
				<button className="home-card" data-home-tone="local" type="button" onClick={props.onSearchFocus}>
					<div className="home-card-label">Song</div>
					<div className="home-card-title" id="home-library-title">常听歌手</div>
					<div className="home-card-sub" id="home-library-sub">你的偏好会在这里汇总</div>
					<div className="home-card-art" id="home-library-art" />
				</button>

				<div className="home-rail">
					<div className="home-section-head">
						<div>
							<div className="home-section-title" id="home-rail-title">先从这里开始</div>
							<div className="home-section-note" id="home-rail-note">点击即可播放</div>
						</div>
					</div>
					<div id="home-tile-row" className="home-tile-row">
						{STARTER_TILES.map((tile) => (
							<button className="home-tile" data-home-tone={tile.tone} type="button" onClick={props.onSearchFocus} key={tile.title}>
								<div className="home-tile-cover" />
								<div className="home-tile-title">{tile.title}</div>
								<div className="home-tile-sub">{tile.sub}</div>
							</button>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
