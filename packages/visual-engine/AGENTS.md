# packages/visual-engine

Tauri 迁移层的可视化引擎。Three.js + GSAP + WebGL + Canvas2D + Web Audio。所有 baseline 视觉行为 1:1 端口自 Electron `public/index.html`，**byte-equal** 锁定关键常量。codegraph/LSP 未启用 — centrality unmeasured。

## STRUCTURE

```
src/
├── index.ts              # 桶导出 + 占位 createVisualEngine stub（向后兼容）
├── splash/               # Splash 启动动画：WebGL + Canvas2D fallback
├── audio/                # 音频反应性：FFT binning / peak follower / beat engine
├── runtime/              # Three.js scene + render loop + cinema camera + render-step registry
├── home-visual/          # HomeVisual 粒子场 + 7 presets + fxDefaults + audio→uniform 映射
├── particles/            # LyricParticles + ConnectorParticles 骨架（spark count 等固定）
├── stage-lyrics/         # Stage 歌词 Three.js mesh builder + lifecycle tickMesh 公式
├── shelf/                # 3D 歌单架：card layout / hover-float / breath / content list / pointer focus
└── control/              # 底部控制台 + SVG displacement map glass texture + GSAP list motion
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 加新视觉模块 | 在 `src/<subdir>/` 下加 + 在 `index.ts` re-export + 在 `runtime/render-step-slot.ts` 注册 RenderStepSlot | 工厂 + DI seam 模式见下 |
| 加新 render step | `runtime/render-step-slot.ts` 枚举 + host 在 `useVisualEngine.ts` 调 `registerStep(slot, fn)` | 11 个 slot 顺序固定：Ripples→FloatLayer→Shelf→LyricParticles→HomeVisual→CameraCinematic→GestureRotation→SkullLayer→StageLyrics→DesktopOverlaySync→ThumbnailPulse → `renderer.render` |
| 改 fxDefaults | `home-visual/fx-defaults.ts` | 88 字段 verbatim 自 baseline public/index.html:3196-3268；硬要求不动视觉节奏 |
| 改 GLSL | `home-visual/home-visual-shaders.ts` 7 个 preset、`stage-lyrics/lyric-shader-material.ts` lyric shader、`splash/splash-webgl.ts`、`particles/*` | 都是从 baseline 字节级复制；**不要创造性改写** |
| 改 SVG glass | `control/control-glass-svg.ts` + `control/control-glass-style.ts` + `control/control-glass-node.ts` | 用户硬要求：**不降低玻璃质感**；filter params (180/170/160 scale、dx=-90 dy=0、stdDev=0.5) byte-equal 锁定 |
| 加新 audio snapshot 字段 | `audio/audio-snapshot.ts` AudioSnapshot + `audio-reactivity.ts` getSnapshot + 下游消费者 | syncFxUniforms (`home-visual/sync-uniforms.ts`)是 surface；改 baseline 公式粒子表现需要 PR review 视觉 parity |
| 改 stage-lyrics 动效 | `stage-lyrics/lifecycle.ts` 的 `tickCurrentMesh` / `tickOutgoingMeshes` / camera lock / starRiver 公式 | 原 Electron `public/index.html` 没有独立歌词 GSAP timeline；切行、入场、退场都由每帧 age/tickMesh 公式驱动 |

## CONVENTIONS（仅记录偏离标准）

- **ThreeFactory DI seam**: 工厂默认 `async () => import("three")`；测试用 `makeFakeThree()` 桩注入。所有调用 three 的模块都在 opts 里接受 `threeFactory?: ThreeFactory`。歌词舞台不使用 GSAP timeline，控制台/歌单架动效才保留 GSAP seam。
- **byte-equal baseline port**: 控制台 SVG filter / splash CSS+VERTEX+FRAGMENT shader / fxDefaults 对象 — 都是 baseline 字节级复制；改前 diff 比对，不要创造性重写。
- **DI factory pattern mirror**: sidecar 适配器、WebAudio host 都沿用 `createXxxAdapter(deps?)` + `defaultDeps` 默认注入 + 测试注入 stub deps 的模式 — 见 sidecar 双适配器。
- **`// NOTE:` 注释仅 8 处**，全部 `control/` + `qq-adapter.ts`（singleton race / logout best-effort）；**无 `// SAFETY:` / `// HACK:` 注释**。
- **测试断言包含 byte-equal**：`control-glass-svg.test.ts`、`splash-webgl.test.ts` 通过 `Buffer.byteLength` 校验字节相等的 baseline ported 字符串。
- **no-network test seam**: AudioContext + WebGL + Canvas + RAF + setTimeout + matchMedia 全部可在测试里用桩替换；`runtime/happy-dom-preload.ts` 提供 DOM polyfill 给需要 document 的测试。

## ANTI-PATTERNS (THIS PROJECT)

- **不要在 visual-engine 里写 React import**：React 在 `apps/web` 那一层；visual-engine 是 platform-neutral lib。
- **不要 remove `createVisualEngine` 占位 stub**（index.ts 顶部）：P2 P8.s1 之前的旧接口；保留向后兼容。
- **不要用 `as any` 绕 TS**：用精确类型 + 三Factory/GsapProvider DI seam。
- **不要跨 `runtime/render-step-slot.ts` 顺序**：11-slot pipeline 对应 baseline `animate()` 26620-26876 行序；改顺序破坏视觉时序反应。
- **不要给 stage-lyrics 重新加独立 GSAP timeline**：原项目 `showStageLine()` 只建 mesh 并把旧 mesh 推入 outgoing，动效由 `updateStageLyrics3D()` 每帧公式驱动。
- **diagnostics 契约**：visual-engine 不向 diagnostics 暴露任何 cookie / 私密变量 — 共享包 `sidecar/api/src/services/diagnostics.ts` 才负责打包 diagnostics payload。

## UNIQUE STYLES

- **shelf-animate.ts 1045 行是最大文件** — 拆 2-3 模块时小心 GSAP timeline 共享状态。
- **home-visual-shaders.ts 7 个 preset GLSL 都 inline** in 484 行；vertex shader 单独 428 行；改前再 baseline diff。
- **stage-lyrics/lifecycle.ts**：包含 LyricGroup lifecycle + palette scene + render step registration；出入场、退场、光效跟随都在 tickMesh 公式内。
- **audio/beat-engine.ts 是唯一纯数学、不依赖 DOM/Three.js 的模块** — 后续可提取为 standalone package。

## COMMANDS

```powershell
# BUN 绝对路径（不在 PATH）
$bun = "C:\Users\zhanw\.bun\bin\bun.exe"
& $bun test packages/visual-engine
& $bun run --filter ./packages/visual-engine typecheck
& $bun run --filter ./apps/web build   # 触发 visual-engine 消费侧构建
```

## NOTES

- codegraph/LSP 未启用，symbol/reference centrality 未测；以 explore agents + manual file read 为 evidence。
- `runtime/uniforms.ts` 直接 `import * as THREE from "three"`（**非** DI seam） — 唯一直接 import；其他 three 用法全走 ThreeFactory。
- `splash/splash-style.ts` 和 `control/control-glass-style.ts` 都用 `let injected = false` 单例 guard 防止重复注入 `<style>`。
- 第一手 baseline spec 在 `docs/migration/baseline/BASELINE_ANIMATION_SPEC.md`；用户硬要求不要降低玻璃质感 / 视觉节奏 / 3D shelf 手感 — 改 baseline-derived 常量前先读该 spec。
