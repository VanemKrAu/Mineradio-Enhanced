# 更新日志

## [1.1.1-8] - 2025-07-09

### 新增

- **PKG 多层壁纸渲染** — WebGL 逐层合成所有纹理（含混合模式、透明度、旋转、缩放），注入 Three.js 场景背景层
- **W/E/Q 编辑快捷键** — W 进入/退出编辑模式，Q 从纹理池添加图层，E 删除顶层图层
- **编辑持久化** — localStorage 自动保存/恢复每层可见性和透明度，重开壁纸恢复上次状态
- **启动自动恢复** — 重启后自动加载上次壁纸的多层渲染 + 编辑状态
- **壁纸分级过滤** — 全年龄/可疑/成人严格分类，互不叠加

### 修复

- **RePKG 纹理提取** — GitHub 单文件发布版替代源码编译版，.tex→PNG 转换正常
- **图层坐标归一化** — 场景像素坐标归一化到 [0,1]，图层相对位置正确
- **scale [0,0] 默认处理** — 默认缩放倍率从 0 修正为 1
- **W 键自由镜头冲突** — 自由镜头激活时不拦截 W 键
- **CSS 背景遮挡** — PKG 加载后隐藏 CSS 单层背景，多层合成可见

## [1.1.1-7] - 2025-07-07

### 新增

- **KRC 歌词解密** — 酷狗歌词二进制格式（XOR + zlib inflate）自动识别并转为标准 LRC 时间戳格式
- **主页歌单架静止** — 主页时歌单 3D 动态镜头/晃动全部冻结，播放页面才活动
- **每日一言主页** — 主页显示热评/时间/日期，支持导入背景图片和自定义热评内容
- **图片裁切上传** — 主页背景图片支持裁剪（缩放/拖拽/保存），自动保持宽高比

### 修复

- **FX 面板穿透** — 歌单架 3D 动画在面板打开时完全静止（parallax/cine shake/card bob/free camera/gesture 五层门控）
- **FX 面板 auto-peek 穿透** — setPeek 打开面板时同步管理 fx-panel-open body 类，两种打开方式统一
- **管理热评弹窗不可见** — 补全 .playlist-select-mask 和 .playlist-select-dialog CSS
- **导入图片弹窗不可见** — 同一 CSS 类缺失导致裁切界面无显示
- **图片裁切消失** — 修复 e._mx/e._my 跨事件对象 NaN bug，改用闭包变量 lastMX/lastMY
- **酷狗歌词前端接口** — r.lyric → r.lrc || r.lyric，补传 duration 参数
- **设置面板点击穿透** — pointer-events: none 扩展到 #playlist-panel * 和 #pl-list *
- **主页图片填满卡片** — 导入图片后卡片 padding 归零 + 负外边距延伸到 hero 边缘，图片完全铺满

## [1.1.1-6] - 2025-07-06

### 删除

- **酷狗概念版** — 移除全部代码（server-kugou-concept.js、6 条路由、前端 UI/函数）
- 酷狗搜索切到标准版 complexsearch API

### 新增

- **SMTC 广播歌词** — Windows 任务栏媒体控件同步显示当前播放歌词
- 酷狗登录后自动获取用户昵称和头像（API 调用）

### 修复

- **酷狗标准版 cookie 无效** — token 检查缺失 `KuGoo` 字段
- 正则 `/D/g` → `/\D/g`
- 安卓签名 `||''` 导致零值参数被裁掉
- 酷狗全链路前后端审查：搜索/歌单/播放/歌词均接通

## [1.1.1-5] - 2025-07-06

### 新增

- **酷狗全链路集成** — 搜索 Tab、歌单分组/详情、歌曲 URL 解析、歌词获取全部支持酷狗概念版
- 登录后右上角账号芯片蓝色发光主题

### 修复

- 安卓签名参数 `||''` 导致 `albumhide=0` 等零值被裁掉，签名计算错误
- `kugouApiRequest` 补充 `kg-rc/kg-thash/kg-rec/kg-rf` 请求头
- 酷狗搜索需登录态检查

## [1.1.1-4] - 2025-07-06

### 修复

- **壁纸重开后变默认** — `restoreWallpaper` 改为重新提取 `folderPath` 纹理，不再依赖被安全策略拦截的 `file://` 缩略图
- **托盘退出卡死/重复图标** — 退出时设 `_quitting` 旗标，`close` 事件放过正常关闭，`createTray` 不重建
- **版本更新检测不工作** — `normalizeVersion` 保留预发布 `-N` 段为第 4 段数字，`compareVersions` 支持四段比较

### 新增

- **WebGL 图层 transform** — shader 增加 per-layer `origin`/`scale` 支持，场景分辨率归一化
- `qrcode` 添加为直接依赖（之前仅作为 `NeteaseCloudMusicApi` 传递依赖）

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
