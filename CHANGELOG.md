# 更新日志

## [1.1.1-3] - 2025-07-06

### 修复

- **大纹理背景不显示** — `setCustomBackgroundImage` 改用 `blob:` URL 替代超大 base64 data URL，解决 4MB+ 纹理在 CSS 变量中静默失败的问题
- **视频壁纸切换不回图片** — `<video>` 元素在非视频模式下强制 `display:none`，不再遮挡新设置的图片背景
- **静态文件浏览器缓存** — `serveStatic` 添加 `Cache-Control: no-cache`，确保前端代码更新后立即生效
- **壁纸扫描初始化** — 修复 `wallpaperPickerData.wallpapers` 和 `roots` 在启动时未填充的问题
- **酷狗概念版登录 API** — 修复 `type/plat` 参数和请求头，改用 v2 端点；修复昵称/头像乱码

### 新增

- `normalizeCustomBackgroundImage` 支持 `blob:` URL
- `readWallpaperFile` 支持 `.mp4`/`.webm` MIME 类型
- 账号信息弹窗芯片新增酷狗蓝色主题样式

## [1.1.1-2] - 2025-07-06

### 新增

- **PKG 场景 WebGL 多层渲染** — 解析 Wallpaper Engine `scene.json`，同时支持 2D `layers` 和 3D `objects` 两种格式，自动追踪 model → material → texture 引用链，按图层顺序逐层绘制
- **PKG 内嵌视频自动检测与优先播放** — `extractWallpaperScene` 可从 `.tex` 文件中提取 MP4/WEBM 视频；检测到视频时优先播放而不是抽取静态纹理
- **智能壁纸源选择** — 自动判断壁纸类型（旁路 `.mp4` 文件 > PKG 内嵌视频 > PKG 纹理），选用最佳可用源
- **5 种混合模式** — WebGL 渲染器支持 `opaque`、`additive`、`translucent`、`multiply`、`screen`
- 桌面壁纸窗口现在可以接收完整场景数据（图层 + 纹理 + 视频）
- `readWallpaperFile` 支持 `.mp4` 和 `.webm` MIME 类型

### 修复

- `scene.json` 现在正确解析 `objects` 数组（3D 场景格式），之前只支持 `layers`（2D 格式）
- RePKG 提取改用 `-s` 扁平模式为主，确保 `scene.json`、模型 JSON、材质 JSON 与纹理一同正确提取
- 旁路 `.mp4` 视频壁纸不再被 PKG 纹理提取覆盖（`wp.mp4File` → `wp.mp4Files` 数组）
- `<video>` 元素层级调整到 WebGL canvas 之上、粒子覆盖层之下
- 桌面壁纸窗口现在从主进程接收场景数据（之前从未收到过）

### 变更

- `wallpaper-scanner.js` 重构：
  - 新增 `extractWallpaperScene()` 返回完整场景描述（图层、纹理、视频、音频）
  - 新增 `parseSceneJson()` 同时支持 2D `layers` 和 3D `objects` 格式，含 model→material→texture 解析链
  - `extractWallpaperTexture()` 优先返回视频文件
  - `extractPkgToCache()` 优先使用 `-s` 扁平提取模式
  - `scanLibrary()` 返回 `mp4Files` 数组 + `hasPkg`/`hasGifPkg` 标志
- `wallpaper.html` WebGL 渲染器：独立 `gl` + `overlay` 双 canvas 架构；视频接管时隐藏 WebGL 层
- `index.html` 壁纸应用流程：MP4 → PKG 视频 → PKG 纹理三级回退
- 参考项目 [win-wallpaper-engine](https://github.com/VanemKrAu/win-wallpaper-engine) 的 PKG 解析和 D3D11 渲染方案

## [1.1.2] - 2025-06-09

_上一个版本 — 详见 git tag。_

## [1.1.1-1] - 2025-06-07

_首个带标签的发布版本。_
