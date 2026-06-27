import { useEffect, useRef, useState } from "react";
import type { HealthResponse, ProviderId } from "@mineradio/shared";
import { SidecarClient, SidecarClientError } from "../api/sidecar-client";
import { usePlaybackStore } from "../stores/playback-store";
import { useProviderStore } from "../stores/provider-store";
import { getRuntimeConfig, type RuntimeConfig } from "../tauri/runtime";

type Phase = "loading" | "connected" | "error";

interface SidecarError {
	code: string;
	message: string;
}

const PROVIDER_ROWS: ProviderId[] = ["netease", "qq"];

function placeholderRuntimeConfig(): RuntimeConfig {
	return {
		sidecarBaseUrl: "",
		appDataDir: "",
		appVersion: "0.0.0-dev",
		schemaVersion: "0.1.0",
	};
}

export function App() {
	const [phase, setPhase] = useState<Phase>("loading");
	const [health, setHealth] = useState<HealthResponse | null>(null);
	const [error, setError] = useState<SidecarError | null>(null);

	const currentTrack = usePlaybackStore((s) => s.currentTrack);
	const isPlaying = usePlaybackStore((s) => s.isPlaying);
	const status = useProviderStore((s) => s.status);
	const matrix = useProviderStore((s) => s.matrix);
	const setMatrix = useProviderStore((s) => s.setMatrix);

	const cancelledRef = useRef(false);

	useEffect(() => {
		cancelledRef.current = false;
		let timer: ReturnType<typeof setTimeout> | null = null;

		async function boot(): Promise<void> {
			let cfg: RuntimeConfig;
			try {
				cfg = await getRuntimeConfig();
			} catch {
				cfg = placeholderRuntimeConfig();
			}
			if (cancelledRef.current) return;

			if (!cfg.sidecarBaseUrl) {
				setPhase("error");
				setError({
					code: "NO_RUNTIME",
					message: "sidecar base url not configured",
				});
				return;
			}

			const client = new SidecarClient(cfg.sidecarBaseUrl);
			let attempts = 0;

			async function poll(): Promise<void> {
				try {
					const h = await client.health();
					if (cancelledRef.current) return;
					setHealth(h);
					setPhase("connected");
					try {
						const caps = await client.capabilities();
						if (!cancelledRef.current) setMatrix(caps);
					} catch {
						// capabilities are best-effort in the shell phase
					}
				} catch (e) {
					if (cancelledRef.current) return;
					attempts += 1;
					if (e instanceof SidecarClientError) {
						setError({ code: e.code, message: e.message });
					} else {
						setError({ code: "UNKNOWN", message: "unknown error" });
					}
					if (attempts < 5) {
						timer = setTimeout(() => {
							void poll();
						}, 800);
					} else {
						setPhase("error");
					}
				}
			}

			void poll();
		}

		void boot();
		return () => {
			cancelledRef.current = true;
			if (timer) clearTimeout(timer);
		};
	}, [setMatrix]);

	function providerRow(id: ProviderId): string {
		if (status && status[id]) {
			return status[id].available
				? `available — ${status[id].message ?? "online"}`
				: `pending — ${status[id].message ?? "not available"}`;
		}
		if (matrix) {
			return "pending";
		}
		return "pending";
	}

	return (
		<main className="shell">
			<section className="status-panel">
				<p className="eyebrow">Mineradio Tauri Rewrite</p>
				<h1>Tauri Rewrite Shell</h1>
				<dl>
					<div>
						<dt>Sidecar</dt>
						<dd>
							{phase === "loading" && "loading…"}
							{phase === "connected" && health && (
								<span>
									connected · api {health.apiVersion} · schema {health.schemaVersion} · providers {health.providers.join(",") || "—"}
								</span>
							)}
							{phase === "error" && error && `${error.code}: ${error.message}`}
						</dd>
					</div>
					<div>
						<dt>Providers</dt>
						<dd>
							<ul className="provider-rows">
								{PROVIDER_ROWS.map((id) => (
									<li key={id}>
										{id}: {providerRow(id)}
									</li>
								))}
							</ul>
						</dd>
					</div>
					<div>
						<dt>Playback</dt>
						<dd>
							{currentTrack
								? `${currentTrack.title} — ${isPlaying ? "playing" : "paused"}`
								: "no track"}
						</dd>
					</div>
					<div>
						<dt>Visual Host</dt>
						<dd>
							<div id="visual-host" className="visual-host" />
						</dd>
					</div>
				</dl>
			</section>
		</main>
	);
}