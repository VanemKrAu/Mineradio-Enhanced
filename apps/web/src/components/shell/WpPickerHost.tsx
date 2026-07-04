import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { invokeTauriCommand } from "../../tauri/runtime";

interface WallpaperEntry {
	title: string;
	folderPath: string;
	previewPath: string | null;
	mp4File: string | null;
	hasScenePkg: boolean;
	workshopId: string | null;
	contentRating: string | null;
	fileSize: number;
}

interface WpPickerHostProps {
	open: boolean;
	onClose: () => void;
}

export function WpPickerHost({ open, onClose }: WpPickerHostProps): ReactElement | null {
	const [wallpapers, setWallpapers] = useState<WallpaperEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [ratingFilter, setRatingFilter] = useState("all");
	const [roots, setRoots] = useState<string[]>(() => {
		try {
			return JSON.parse(localStorage.getItem("mineradio-wallpaper-roots") || "[]");
		} catch {
			return [];
		}
	});
	const scanRef = useRef(0);

	const doScan = useCallback(async (rootsToScan: string[]) => {
		if (rootsToScan.length === 0) return;
		const seq = ++scanRef.current;
		setLoading(true);
		try {
			const result = await invokeTauriCommand<WallpaperEntry[]>("wallpaper_scan_libraries");
			if (seq === scanRef.current && result) setWallpapers(result);
		} catch {
			// silent
		} finally {
			if (seq === scanRef.current) setLoading(false);
		}
	}, []);

	const doAutoDetect = useCallback(async () => {
		try {
			const detected = await invokeTauriCommand<string[]>("wallpaper_auto_detect_roots");
			if (detected && detected.length > 0) {
				const merged = [...new Set([...roots, ...detected])];
				setRoots(merged);
				localStorage.setItem("mineradio-wallpaper-roots", JSON.stringify(merged));
				void doScan(merged);
			}
		} catch {
			// silent
		}
	}, [roots, doScan]);

	useEffect(() => {
		if (!open) return;
		void doScan(roots);
	}, [open, roots, doScan]);

	// Also auto-detect on first open if no roots
	useEffect(() => {
		if (!open || roots.length > 0) return;
		void doAutoDetect();
	}, [open, roots.length, doAutoDetect]);

	const filtered = wallpapers.filter((wp) => {
		if (search && !wp.title.toLowerCase().includes(search.toLowerCase())) return false;
		if (ratingFilter !== "all" && wp.contentRating !== ratingFilter) return false;
		return true;
	});

	const handleApply = useCallback(async (wp: WallpaperEntry) => {
		// Save current wallpaper to localStorage
		localStorage.setItem("mineradio-wallpaper-current", JSON.stringify(wp));

		if (wp.mp4File) {
			try {
				const dataUrl = await invokeTauriCommand<string>("wallpaper_read_file", { path: wp.mp4File });
				if (dataUrl) {
					// Dispatch event for the visual engine to pick up
					window.dispatchEvent(new CustomEvent("mineradio-wallpaper-media", {
						detail: { type: "video", url: dataUrl, title: wp.title },
					}));
				}
			} catch {
				// fallback to texture extraction
			}
		} else if (wp.hasScenePkg) {
			try {
				const result = await invokeTauriCommand<{ ok: boolean; pngPath: string | null; error: string | null }>(
					"wallpaper_extract_texture",
					{ folderPath: wp.folderPath },
				);
				if (result?.ok && result.pngPath) {
					const dataUrl = await invokeTauriCommand<string>("wallpaper_read_file", { path: result.pngPath });
					if (dataUrl) {
						window.dispatchEvent(new CustomEvent("mineradio-wallpaper-media", {
							detail: { type: "image", url: dataUrl, title: wp.title },
						}));
					}
				}
			} catch {
				// silent
			}
		} else if (wp.previewPath) {
			try {
				const dataUrl = await invokeTauriCommand<string>("wallpaper_read_file", { path: wp.previewPath });
				if (dataUrl) {
					window.dispatchEvent(new CustomEvent("mineradio-wallpaper-media", {
						detail: { type: "image", url: dataUrl, title: wp.title },
					}));
				}
			} catch {
				// silent
			}
		}
		onClose();
	}, [onClose]);

	if (!open) return null;

	return (
		<div
			id="wp-picker-modal"
			className="modal-mask show"
			role="presentation"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="wp-picker-dialog" role="dialog" aria-modal="true" aria-label="壁纸库">
				<div className="wp-picker-head">
					<h2>壁纸库</h2>
					<button className="wp-close-btn" type="button" onClick={onClose} aria-label="关闭">×</button>
				</div>
				<div className="wp-picker-toolbar">
					<input
						type="text"
						className="wp-search-input"
						placeholder="搜索壁纸..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<select
						className="wp-rating-select"
						value={ratingFilter}
						onChange={(e) => setRatingFilter(e.target.value)}
					>
						<option value="all">全部</option>
						<option value="everyone">全年龄</option>
						<option value="suggestive">可疑</option>
						<option value="adult">成人</option>
					</select>
					<button className="wp-tool-btn" type="button" onClick={() => void doScan(roots)} disabled={loading}>
						{loading ? "扫描中..." : "刷新"}
					</button>
					<button className="wp-tool-btn" type="button" onClick={() => void doAutoDetect()}>
						自动检测
					</button>
					<button
						className="wp-tool-btn"
						type="button"
						onClick={async () => {
							try {
								await invokeTauriCommand("wallpaper_clear_cache");
							} catch { /* silent */ }
						}}
					>
						清理缓存
					</button>
				</div>
				<div className="wp-picker-grid">
					{filtered.length === 0 && !loading && (
						<div className="wp-empty">没有找到壁纸，请点击"自动检测"或手动添加目录</div>
					)}
					{filtered.map((wp) => (
						<button
							key={wp.folderPath}
							type="button"
							className="wp-card"
							onClick={() => void handleApply(wp)}
							title={wp.title}
						>
              {wp.previewPath ? (
                <WpThumbnail path={wp.previewPath} title={wp.title} />
              ) : (
							) : (
								<div className="wp-thumb-placeholder">{wp.title[0]}</div>
							)}
							<span className="wp-card-title">{wp.title}</span>
							{wp.mp4File && <span className="wp-card-badge">MP4</span>}
						</button>
					))}
n
function WpThumbnail({ path, title }: { path: string; title: string }): ReactElement {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    invokeTauriCommand<string>("wallpaper_read_file", { path })
      .then((dataUrl) => { if (!cancelled && dataUrl) setSrc(dataUrl); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [path]);
  if (src) {
    return <img className="wp-thumb" src={src} alt={title} loading="lazy" />;
  }
  return <div className="wp-thumb-placeholder">{title[0]}</div>;
}
				</div>
			</div>
		</div>
	);
}
