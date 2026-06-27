type DustParticle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	a: number;
	p: number;
};

type Streak = {
	x: number;
	y: number;
	len: number;
	width: number;
	speed: number;
	angle: number;
	phase: number;
	color: string;
	delay: number;
	alpha: number;
};

type Shard = {
	ox: number;
	oy: number;
	w: number;
	h: number;
	skew: number;
	phase: number;
	color: string;
	alpha: number;
};

export type SplashCanvasHandle = {
	render(elapsed: number): void;
	resize(width: number, height: number): void;
	dispose(): void;
};

export type SplashCanvasOptions = {
	reducedMotion?: boolean;
};

const STREAK_COLORS = ["rgba(244,210,138,", "rgba(122,215,194,", "rgba(255,83,103,", "rgba(157,184,207,"];

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}
function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
	return t * t * (3 - 2 * t);
}
function easeOutCubic(t: number): number {
	const c = clamp01(t);
	return 1 - Math.pow(1 - c, 3);
}
function rand(): number {
	return Math.random();
}

export function createSplashCanvas(canvas: HTMLCanvasElement, opts: SplashCanvasOptions = {}): SplashCanvasHandle {
	const ctx = canvas.getContext("2d");
	const reducedMotion = opts.reducedMotion ?? false;

	let pixelRatio = 1;
	let cssW = 0;
	let cssH = 0;
	let dust: DustParticle[] = [];
	let streaks: Streak[] = [];
	let shards: Shard[] = [];

	function resize(width: number, height: number): void {
		pixelRatio = Math.min(1.6, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
		cssW = width;
		cssH = height;
		canvas.width = Math.max(1, Math.floor(cssW * pixelRatio));
		canvas.height = Math.max(1, Math.floor(cssH * pixelRatio));
		if (ctx) ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		reset();
	}

	function reset(): void {
		dust = [];
		streaks = [];
		shards = [];
		const count = reducedMotion ? 28 : 84;
		for (let i = 0; i < count; i++) {
			dust.push({
				x: rand() * cssW,
				y: rand() * cssH,
				vx: (rand() - 0.5) * 0.18,
				vy: (rand() - 0.5) * 0.11,
				r: rand() * 1.35 + 0.28,
				a: rand() * 0.105 + 0.025,
				p: rand() * Math.PI * 2,
			});
		}
		const streakCount = reducedMotion ? 6 : 22;
		for (let s = 0; s < streakCount; s++) {
			streaks.push({
				x: rand() * cssW,
				y: cssH * (0.2 + rand() * 0.62),
				len: cssW * (0.12 + rand() * 0.24),
				width: 0.75 + rand() * 2.1,
				speed: cssW * (0.00028 + rand() * 0.00042),
				angle: ((-10 + rand() * 20) * Math.PI) / 180,
				phase: rand() * Math.PI * 2,
				color: STREAK_COLORS[s % STREAK_COLORS.length],
				delay: rand() * 1.1,
				alpha: 0.18 + rand() * 0.36,
			});
		}
		const shardCount = reducedMotion ? 10 : 34;
		for (let h = 0; h < shardCount; h++) {
			shards.push({
				ox: (rand() - 0.5) * 0.92,
				oy: (rand() - 0.5) * 0.22,
				w: 18 + rand() * 86,
				h: 1 + rand() * 5,
				skew: (rand() - 0.5) * 20,
				phase: rand() * Math.PI * 2,
				color: STREAK_COLORS[h % STREAK_COLORS.length],
				alpha: 0.1 + rand() * 0.24,
			});
		}
	}

	if (typeof window !== "undefined") {
		resize(window.innerWidth, window.innerHeight);
	} else {
		resize(0, 0);
	}

	function render(elapsed: number): void {
		if (!ctx) return;
		ctx.clearRect(0, 0, cssW, cssH);

		const base = ctx.createLinearGradient(0, 0, cssW, cssH);
		base.addColorStop(0, "rgba(1,6,7,0.68)");
		base.addColorStop(0.45, "rgba(10,9,12,0.74)");
		base.addColorStop(1, "rgba(0,0,0,0.84)");
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, cssW, cssH);

		ctx.save();
		ctx.globalAlpha = 0.22;
		ctx.fillStyle = "rgba(255,255,255,0.035)";
		const scanOffset = (elapsed * 28) % 36;
		for (let sy = -scanOffset; sy < cssH; sy += 36) ctx.fillRect(0, sy, cssW, 1);
		ctx.restore();

		for (let i = 0; i < dust.length; i++) {
			const d = dust[i]!;
			d.x += d.vx;
			d.y += d.vy;
			d.p += 0.018;
			if (d.x < -10) d.x = cssW + 10;
			if (d.x > cssW + 10) d.x = -10;
			if (d.y < -10) d.y = cssH + 10;
			if (d.y > cssH + 10) d.y = -10;
			const alpha = d.a * (0.58 + Math.sin(d.p + elapsed * 0.8) * 0.34);
			ctx.beginPath();
			ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255,255,255," + Math.max(0, alpha) + ")";
			ctx.fill();
		}

		ctx.save();
		ctx.globalCompositeOperation = "lighter";
		for (let k = 0; k < streaks.length; k++) {
			const st = streaks[k]!;
			const travel = (elapsed * st.speed * 240 + st.x + Math.sin(elapsed * 0.8 + st.phase) * 28) % (cssW + st.len + 180);
			const px = travel - st.len - 90;
			const py = st.y + Math.sin(elapsed * 0.75 + st.phase) * 18;
			const fade = smoothstep(st.delay * 0.55, st.delay * 0.55 + 0.52, elapsed) * (1 - smoothstep(3.52, 4.12, elapsed));
			if (fade <= 0) continue;
			ctx.save();
			ctx.translate(px, py);
			ctx.rotate(st.angle);
			const sg = ctx.createLinearGradient(-st.len * 0.5, 0, st.len * 0.5, 0);
			sg.addColorStop(0, st.color + "0)");
			sg.addColorStop(0.52, st.color + (st.alpha * fade).toFixed(3) + ")");
			sg.addColorStop(1, "rgba(255,255,255,0)");
			ctx.strokeStyle = sg;
			ctx.lineWidth = st.width;
			ctx.shadowColor = st.color + (0.34 * fade).toFixed(3) + ")";
			ctx.shadowBlur = 18;
			ctx.beginPath();
			ctx.moveTo(-st.len * 0.5, 0);
			ctx.lineTo(st.len * 0.5, 0);
			ctx.stroke();
			ctx.restore();
		}

		const lineT = easeOutCubic((elapsed - 0.12) / 1.18);
		const exitFade = 1 - smoothstep(3.58, 4.12, elapsed);
		if (lineT > 0 && exitFade > 0 && ctx) {
			const centerY = cssH * 0.5 + Math.sin(elapsed * 1.4) * 1.6;
			const slitW = cssW * (0.16 + lineT * 0.72);
			const left = cssW * 0.5 - slitW * 0.5;
			const right = cssW * 0.5 + slitW * 0.5;
			const coreAlpha = (0.34 + lineT * 0.58) * exitFade;
			const slitGrad = ctx.createLinearGradient(left, centerY, right, centerY);
			slitGrad.addColorStop(0, "rgba(255,83,103,0)");
			slitGrad.addColorStop(0.18, "rgba(255,83,103," + (0.18 * exitFade).toFixed(3) + ")");
			slitGrad.addColorStop(0.5, "rgba(255,255,255," + coreAlpha.toFixed(3) + ")");
			slitGrad.addColorStop(0.68, "rgba(244,210,138," + (0.38 * exitFade).toFixed(3) + ")");
			slitGrad.addColorStop(0.84, "rgba(122,215,194," + (0.2 * exitFade).toFixed(3) + ")");
			slitGrad.addColorStop(1, "rgba(122,215,194,0)");
			ctx.shadowColor = "rgba(244,210,138," + (0.48 * exitFade).toFixed(3) + ")";
			ctx.shadowBlur = 42 + lineT * 42;
			ctx.lineCap = "round";
			ctx.strokeStyle = slitGrad;
			ctx.lineWidth = 1.4 + lineT * 2.2;
			ctx.beginPath();
			ctx.moveTo(left, centerY);
			ctx.lineTo(right, centerY);
			ctx.stroke();

			const ignition = Math.exp(-Math.pow((elapsed - 0.72) / 0.26, 2));
			if (ignition > 0.018) {
				const ig = ctx.createLinearGradient(0, centerY, cssW, centerY);
				ig.addColorStop(0, "rgba(122,215,194,0)");
				ig.addColorStop(0.46, "rgba(122,215,194," + (0.07 * ignition).toFixed(3) + ")");
				ig.addColorStop(0.5, "rgba(255,255,255," + (0.16 * ignition).toFixed(3) + ")");
				ig.addColorStop(0.54, "rgba(255,83,103," + (0.08 * ignition).toFixed(3) + ")");
				ig.addColorStop(1, "rgba(244,210,138,0)");
				ctx.fillStyle = ig;
				ctx.fillRect(0, centerY - 48 * ignition, cssW, 96 * ignition);
			}

			const waveAlpha = smoothstep(0.72, 1.95, elapsed) * exitFade;
			if (waveAlpha > 0) {
				ctx.shadowBlur = 20;
				ctx.strokeStyle = "rgba(244,210,138," + (0.22 * waveAlpha).toFixed(3) + ")";
				ctx.lineWidth = 1;
				ctx.beginPath();
				const steps = 82;
				for (let wi = 0; wi <= steps; wi++) {
					const u = wi / steps;
					const x = left + slitW * u;
					const edge = 1 - Math.abs(u - 0.5) * 2;
					const amp = (4 + 18 * lineT) * Math.pow(Math.max(0, edge), 1.4) * waveAlpha;
					const y = centerY + Math.sin(u * 34 + elapsed * 8.2) * amp + Math.sin(u * 87 - elapsed * 5.1) * amp * 0.18;
					if (wi === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.stroke();
			}

			const shardT = smoothstep(0.72, 2.45, elapsed) * exitFade;
			for (let si = 0; si < shards.length; si++) {
				const sh = shards[si]!;
				const drift = Math.sin(elapsed * 1.7 + sh.phase) * 22;
				const sx = cssW * 0.5 + sh.ox * cssW * (0.18 + shardT * 0.82) + drift;
				const sy = centerY + sh.oy * cssH * (0.2 + shardT * 0.92);
				const localAlpha = sh.alpha * shardT * (0.62 + Math.sin(elapsed * 5 + sh.phase) * 0.38);
				if (localAlpha <= 0) continue;
				ctx.save();
				ctx.translate(sx, sy);
				ctx.rotate(((-6 + sh.skew * 0.1) * Math.PI) / 180);
				ctx.fillStyle = sh.color + Math.max(0, localAlpha).toFixed(3) + ")";
				ctx.shadowColor = sh.color + Math.min(0.38, localAlpha * 1.2).toFixed(3) + ")";
				ctx.shadowBlur = 14;
				ctx.beginPath();
				ctx.moveTo(-sh.w * 0.5, -sh.h * 0.5);
				ctx.lineTo(sh.w * 0.5, -sh.h * 0.5);
				ctx.lineTo(sh.w * 0.5 + sh.skew, sh.h * 0.5);
				ctx.lineTo(-sh.w * 0.5 + sh.skew, sh.h * 0.5);
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			}

			const flash = Math.exp(-Math.pow((elapsed - 2.52) / 0.38, 2));
			if (flash > 0.015) {
				const fg = ctx.createLinearGradient(0, centerY, cssW, centerY);
				fg.addColorStop(0, "rgba(255,83,103,0)");
				fg.addColorStop(0.48, "rgba(255,255,255," + (0.2 * flash).toFixed(3) + ")");
				fg.addColorStop(0.52, "rgba(244,210,138," + (0.24 * flash).toFixed(3) + ")");
				fg.addColorStop(1, "rgba(122,215,194,0)");
				ctx.fillStyle = fg;
				ctx.fillRect(0, centerY - 46 * flash, cssW, 92 * flash);
			}
		}
		ctx.restore();
	}

	return {
		render,
		resize,
		dispose() {
			dust = [];
			streaks = [];
			shards = [];
		},
	};
}