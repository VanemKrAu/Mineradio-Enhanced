# Baseline Animation Spec

更新时间：2026-06-27

本文用 Electron baseline 代码冻结视觉、动画和交互手感规格。后续 Tauri `visual-engine` 迁移以这些代码派生规格为准，不再把补录截图/录屏作为 P1 的当前阻塞项。已采集截图仍作为辅助参考，最终公开发布前仍需要人工 WebView2 parity 检查。

## 代码依据

- `public/index.html`
- `public/desktop-lyrics.html`
- `desktop/main.js`
- `desktop/preload.js`
- `desktop/overlay-preload.js`
- `docs/GLASS_SVG_TEXTURE.md`

## 启动 Splash

入口和状态：

- CSS 位于 `public/index.html:114` 到 `public/index.html:144`。
- WebGL/Canvas 初始化位于 `public/index.html:25547` 到 `public/index.html:25808`。
- 退出逻辑位于 `public/index.html:26054`；ready 时序位于 `public/index.html:26101` 和 `public/index.html:26133`。
- `body.splash-active`、`body.splash-revealing`、`#splash.ready`、`#splash.exiting` 驱动启动、准备点击和退出状态。

视觉规格：

- `#splash` 黑底、内阴影、1180ms opacity/scale 退出，缓动 `cubic-bezier(.16,1,.3,1)`。
- 背景层使用多重线性渐变、网格纹理和 `splash-field-breathe` 7s 循环呼吸。
- wordmark 拆成 `Mine` 和 `Radio` 两段，`Mine` 在 5200ms 内完成 clip-path 揭示、skew 修正和横向分离；`Radio` 延后进入，使用渐变文字和背景位置推进。
- `i` 点使用 `splash-i-dot-pop`，4200ms 内从下方小圆点弹入。
- 信号线使用 `splash-signal-line` 和 `splash-signal-blip`，4200ms 内从细线扩展到脉冲，再收束为 afterglow。
- WebGL splash 使用 `initMineradioSplashWebgl()`，`powerPreference: high-performance`，shader 内 `uTime` 驱动 neon loop、sync band、climax、afterglow、calm/settle；无 WebGL 或 reduced motion 时退到 Canvas dust/streak/shard。
- Canvas fallback 按 DPR 最大 1.6 初始化，生成 dust、streaks、shards；`drawMineradioSplash()` 使用 RAF 循环。
- `dismissSplash()` 清理 timer，调用 `revealIdleParticles(0, 2400)`，添加 `splash-revealing` 和 `.exiting`，内容层用 680ms opacity 与 980ms transform 上移淡出，1180ms 后隐藏 splash 并触发启动 guide。
- `markSplashReadyToEnter()` 添加 `.ready`；首次 ready timer 约 900ms，fallback 约 5000ms。

迁移落点：

- `packages/visual-engine/src/splash/`：管理 splash lifecycle、WebGL shader、Canvas fallback、ready/exiting 状态。
- React 只挂载容器、传递 reduced-motion 和退出回调。

## 主视觉 Render Loop

入口：

- 全局音频响应变量位于 `public/index.html:2677`。
- 音频初始化位于 `public/index.html:17728`。
- 实时 beat engine 位于 `public/index.html:4391`。
- 主 loop 位于 `public/index.html:26620` 到 `public/index.html:26876`。

规格：

- 每帧 `requestAnimationFrame(animate)`，`dt` clamp 到 `0.05`。
- 自适应限帧通过 `shouldSkipAdaptiveRenderFrame()`，并采样 FPS、long frame 和 cache trim。
- splash 遮挡时仅每 520ms warm render 一帧，避免主场景完全冷启动。
- 音频分析使用 `AnalyserNode` 的 frequency/time domain 数据，精确分离：
  - kick：bin 0 到 7，约 60-150Hz。
  - vocal：bin 7 到 140，约 200-3000Hz。
  - mid：bin 140 到 280，约 3-6kHz。
  - treble：bin 280 以上。
- 动态峰值跟踪 `bassPeak`、`midPeak`、`treblePeak`、`energyPeak`，再导出 `rb/rm/rt/re`。
- 实时 beat engine 和 beatmap 协同产生 `beatPulse`、`scheduledBeatPulse`、`beatOnsetFlag`，并调度 camera beat。
- `AnalyserNode.fftSize=2048`；主 analyser `smoothingTimeConstant=.58`，beat analyser `.10`，同一个 media source 同时连接主频谱和 beat 频谱。
- 实时 beat engine 另有更细分频段：sub 38-74Hz、kick 52-165Hz、body 165-420Hz、vocal 420-2600Hz、snap 1800-9200Hz；用 fast/slow follower、flux、onset 与 tempo lock 判断 hit。
- 输出 uniforms：`uBass`、`uMid`、`uTreble`、`uBeat`、`uEnergy`、`uMouseXY`、`uMouseActive`、`uVinylSpin`、`uParticleDim`、`uBurstAmt`。
- 每帧顺序：pointer/parallax -> audio analysis -> ripples -> float layer -> shelf -> lyric particles -> home visual -> cinema/free camera/camera -> gesture rotation -> skull layer -> stage lyrics -> desktop overlay sync -> thumbnail pulse -> `renderer.render(scene,camera)`。

迁移落点：

- `packages/visual-engine/src/runtime/render-loop.ts`
- `packages/visual-engine/src/audio/audio-reactivity.ts`
- `packages/visual-engine/src/camera/cinema.ts`
- `packages/visual-engine/src/presets/`

## 底部播放控制台和列表动效

入口：

- 控制台 CSS 位于 `public/index.html:523`。
- 控制台显隐：`public/index.html:5258` 到 `public/index.html:5308`。
- 播放模式按钮：`public/index.html:18761` 到 `public/index.html:18785`。
- 控制按钮 GSAP：`public/index.html:18937` 到 `public/index.html:18987`。
- 列表入场和滚动：`public/index.html:19154` 到 `public/index.html:19275`。
- 玻璃 SVG 位移图：`public/index.html:18831` 到 `public/index.html:18935`，补充见 `docs/GLASS_SVG_TEXTURE.md`。

规格：

- `#bottom-bar` 默认 `opacity:0; transform: translateX(-50%) translateY(36px) scale(.972)`；`.visible` 为 `opacity:.91; translateY(0) scale(1)`；`.soft-hidden` 下滑到 `translateY(88px)`。
- `revealBottomControls(delay)` 为底栏添加 `visible`，调用 `setControlsHidden(false)`，默认 520ms 后自动 hide；shelf 打开、详情打开或 suppress timer 未过期时禁止显示。
- `setControlsHidden(true)` 只在 `controlsHovering` 和 `miniQueueOpen` 均为 false 时添加 `soft-hidden`。
- 播放按钮 hover：y=-2，scale 约 1.07；普通按钮 hover scale 约 1.08；press scale 约 0.90；release 使用 `back.out(1.8/1.9)` 回弹。
- click pulse 使用 box-shadow 从 0 扩展到 18px（播放按钮）或 10px（普通按钮），播放按钮持续 0.58s，普通按钮 0.42s。
- 播放模式切换先 scale 0.86/rotate -8 到 scale 1.12/rotate 4，再 `back.out(2.1)` 回到 1；icon 从 y=4、alpha .32、rotate -22、scale .74 入场。
- `animateListItems()` 对前 18 项执行 alpha 0 -> 1、x/y -> 0、duration 0.22s、stagger 0.012、`power2.out`。
- smooth wheel 把 wheel delta 映射到 GSAP `scrollTop` tween，duration 0.24s。
- 玻璃效果必须保留 SVG displacement map、`feOffset` chromatic offset、rounded-rect map 和 `control-glass-svg-ok` 分支，不能降级为普通透明 blur 面板。

迁移落点：

- React 控制 DOM 状态和事件。
- `packages/visual-engine/src/ui-motion/player-controls.ts` 保存 GSAP 参数。
- `apps/web/src/components/player/` 负责使用同名状态 class。

## Stage Lyrics

入口：

- CSS 入场/浮动/退场：`public/index.html:1810` 到 `public/index.html:1816`。
- Three.js stage lyric 状态位于 `public/index.html:7204`。
- `buildLyricMesh()` 位于 `public/index.html:8809`；`showStageLine()` 位于 `public/index.html:8946`；`updateStageLyrics3D()` 位于 `public/index.html:8980`；逐字/逐行进度位于 `public/index.html:9271`。
- 每帧更新：`public/index.html:26864` 调用 `updateStageLyrics3D(dt)`。

规格：

- `.stage-lyric-line` 使用大号渐变文字、drop shadow、preserve-3d、`will-change: transform, opacity, filter`。
- 入场 `lyr-in`：900ms，缓动 `cubic-bezier(.16,.84,.32,1.02)`；从自定义 `--inx/--iny/-160px`、rotateX/rotateY、scale .7、blur 14px 入场。
- 浮动 `lyr-bob`：入场 900ms 后开始，5.6s 无限循环，横向 ±6px、纵向 -7/3/-4px，Z 0/12/8px，小角度 X/Y 摆动，scale 在 .99 到 1.01。
- 退场 `lyr-out`：700ms，`cubic-bezier(.55,0,.85,.45)`，移出到 `--outx/--outy/-120px`、scale .78、blur 10px。
- 实际主线不是纯 DOM lyric，而是 Three.js mesh：`buildLyricMesh()` 创建 text plane、readability layer、additive glow、sun bloom 和 132 个 spark points，renderOrder 约 40-44。
- `showStageLine()` 会把当前歌词转 outgoing，新歌词新建 mesh，并通过 `updateLyricMeshProgress()` 写 shader `uProgress`。
- `updateStageLyrics3D()` 用 `lyricGlowStrength`、`lyricSunEnergy`、`beatPulse`、camera beat 生成 `highBloom` 和 `beatGlow`；3D shelf 详情打开时歌词降到约 `opacity .30-.38`，避免遮挡详情。
- YRC word 优先；无逐字歌词时按行级 smoothstep fallback。`tickLyricsParticles()` 根据 `audio.currentTime` 切行。

迁移落点：

- `packages/visual-engine/src/lyrics/stage-lyrics.ts`
- `packages/shared` 后续定义 lyric timing snapshot。

## 3D 歌单架

入口：

- `shelfSettings()`：`public/index.html:7762`。
- `shelfLayoutProfile()`：`public/index.html:12769`。
- `makeShelfManager()`：`public/index.html:12964`。
- 卡片布局：`public/index.html:13334` 到 `public/index.html:13450`。
- 详情打开/关闭：`public/index.html:14380` 到 `public/index.html:14510`。
- pointer focus：`public/index.html:25427` 到 `public/index.html:25513`。

规格：

- 渲染窗口使用 `SHELF_VISIBLE_RADIUS` 和 `SHELF_MAX_RENDER`，只构建中心附近卡片，不能一次性渲染全部歌单。
- side 模式布局以 `centerSmooth` 为基准，delta 决定 x/y/z、scale、opacity、renderOrder。
- side 打开入场：按 `absD` stagger，`revealRaw=(uTime-shelfOpenAnimAt-absD*0.035)/0.62`，smoothstep 后参与 position、scale、opacity。
- 切页/切源：`paneRaw=(uTime-paneSwitchAt-absD*0.030)/0.72`，通过 `paneSwitchDir` 对 x/y/z 和 opacity 做横向滑入。
- hover 浮起：`card.floatMix` 以 attack .20/release .13 追踪 selected；浮起时 x/y/z 前移，scale 增加，renderOrder 提升。
- 呼吸：`breathPulse=shelfVisibility*(0.5+0.5*sin(uTime*1.22+index*.74))`，影响 y/z/scale/opacity。
- stage 模式横向展开：delta 控制 x、z、rotationY、scale；中心卡 scale 1.20，远端 opacity 按 absD 衰减。
- 详情页打开时 `group.userData.detailIntro=1`，GSAP 0.48s `power3.out` 到 0；关闭时 scale 0.965、position 右下后退、material opacity 0，duration 0.16-0.18s。
- loading 行 30fps 刷新，中心行高亮，按钮只在 center 行出现。
- pointer focus 区分 queue、shelf-side、shelf-stage、shelf-detail；左侧 DOM 面板和右侧 3D shelf 不抢焦点。

迁移落点：

- `packages/visual-engine/src/shelf/shelf-manager.ts`
- `packages/visual-engine/src/shelf/shelf-layout.ts`
- `packages/visual-engine/src/shelf/detail-list.ts`
- React/Zustand 只传入 playlist/queue snapshots 和 action callbacks。

## Desktop Lyrics

入口：

- 主窗口 payload：`public/index.html:26140` 到 `public/index.html:26372`。
- 桌面歌词页面 CSS：`public/desktop-lyrics.html:8` 到 `public/desktop-lyrics.html:120`。
- 歌词入场 CSS 位于 `public/desktop-lyrics.html:122`。
- 字体适配和横向滚动：`public/desktop-lyrics.html:578` 到 `public/desktop-lyrics.html:686`。
- 动作和光效：`public/desktop-lyrics.html:714` 到 `public/desktop-lyrics.html:1019`。
- 拖动/中键/锁定：`public/desktop-lyrics.html:1032` 到 `public/desktop-lyrics.html:1208`。
- Electron 窗口与鼠标穿透：`desktop/main.js:713` 到 `desktop/main.js:975`、`desktop/main.js:1220` 到 `desktop/main.js:1285`。

规格：

- payload 包含 enabled、text、progress、progressSpan、playing、size、opacity、y、clickThrough、cinema、highlightFollow、frameRate、fontFamily、fontWeight、letterSpacing、lineHeight、lyricScale、feather、motion、playback、beatMapKey、colors。
- 推送节流：按 `desktopLyricsFps` 归一到 24/30/60/120fps；未设 fps 时最小间隔 8ms；相同 key 900ms 内不重复发送。
- `.line.in` 使用 `lyr-in 820ms cubic-bezier(.16,.84,.32,1.02)`，从 `translate3d(0,32px,-120px) rotateX(24deg) rotateY(-18deg) scale(.78)` 和 blur 12px 入场。
- 文本适配：基于窗口宽度计算 edgeWidth、viewportWidth、clearWidth；最多 24 次递减字体；长句允许 scaleX 最低 .72；需要滚动时 mask edge 缩到约 26-58px。
- 横向滚动：初始 hold `progressSpan*130` clamp 到 140-520ms；滚动曲线 `smootherstep`；start gate 约 .035-.18，end gate 约 .62-.88，长句和短句有 bias。
- 高亮：`body.highlight .line` 用 `--lyric-progress` 和 `--lyric-feather` 生成跟唱渐变；原生 karaoke feather .030，否则 .055。
- 舞台漂浮：每帧计算 lift、floatX/Y、rotX/Y、scale、brightness、saturate；beat attack .46/.62，release .16/.18。
- glow：Canvas aura、highlight bloom、glow text 由 `lyricGlow`、`lyricGlowBeat`、`lyricGlowStrength`、beatMap/offline motion 和 bass 共同驱动。
- 交互：锁定时 `clickThrough` true；中键在热区内切换锁定，260ms debounce；解锁时左键拖动通过 `moveLyricsBy(dx,dy)` 移动窗口；hover 1.5s 显示提示。
- Electron 当前用 `setIgnoreMouseEvents(shouldIgnore,{forward:true})`、always-on-top `screen-saver`、visible-on-all-workspaces 和 PowerShell mouse poller 处理 Windows 中键锁定。

迁移落点：

- Rust/Tauri：桌面歌词窗口、always-on-top、click-through、middle-click hot bounds、move-by。
- `apps/web/src/desktop-lyrics/`：复刻 desktop lyrics page 或共享 visual-engine renderer。
- `packages/shared/src/desktop.ts`：定义 payload schema。

## 验收口径

- P1 当前完成标准：本代码派生规格已存在并链接到 capability checklist。
- 后续 visual-engine 实现必须逐项映射本规格，不得只凭截图重写。
- 最终公开发布前仍要运行 Windows/WebView2 手动 parity，但截图/录屏不再阻塞 P1 文档阶段。
