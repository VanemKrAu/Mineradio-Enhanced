# Migration Decisions

更新时间：2026-06-27

本文件锁死 Tauri 迁移过程中需要用户拍板的关键决策。后续 agent 必须按本文件执行，未经用户同意不得变更。私密凭证（B1/B2）不写入本文件，发布前由用户单独提供并就地注入。

## A 类决策（产品/工程方向，已锁定）

| 编号 | 决策项 | 最终值 | 锁定依据 |
| --- | --- | --- | --- |
| A1 | 最终 app id / 品牌名 | app id `com.mineradio.fork.tauri`；productName `Mineradio Tauri Rewrite` | 不复用旧 `com.mineradio.desktop`；明确二开/fork 身份，避免与原 Mineradio 品牌混淆 |
| A2 | 最终发布 logo | 复用 Electron baseline `build/icon.ico`（已复制到 `apps/desktop/src-tauri/icons/icon.ico`） | 用户决定不再单独出 logo，发布即用 baseline 图标 |
| A3 | 仓库 / updater 通道 | GitHub Release 为权威资产源 + 动态 update-server JSON（Tauri updater `endpoints`）；新仓库 `github.com/zzstar101/Mineradio`；不迁旧 Electron patch JSON 系统 | 用户指定新仓库 |
| A4 | 国内镜像 | Bun/npm 用官方 registry（已可用）；updater 资产可用 gh-proxy 类镜像列表作可选 mirror，不写入长期 registry 配置 | 证书问题已自行恢复，无需镜像 workaround |
| A5 | Windows 安装器策略 | Tauri 内置 NSIS：`oneClick:false`、`perMachine:false`、`allowToChangeInstallationDirectory:false`、桌面+开始菜单快捷方式、新数据目录不读旧 Mineradio 用户目录；`perMachine:false` 走 per-user 安装 | 对齐 Electron baseline 安装体验，避免读取旧用户数据 |
| A6 | QQ provider license | 接入 `jsososo/QQMusicApi`（GPL-3.0，npm 包 `qq-music-api`）；`sansenjian/qq-music-api` 不接入（MIT 文件 + README 「不可商业用途」附加条款与 GPL-3.0 「no further restrictions」冲突，组合作品无法在 GPL-3.0 下分发） | jsososo 与本项目同 GPL-3.0，无歧义；sansenjian 有合规风险 |
| A7 | 延期能力发布前处置 | Wallpaper 深联动 / 实验壁纸模式 / 手势识别 hand-canvas = `hidden`（发布前隐藏入口）；旧 Electron patch JSON 系统 / 旧用户数据自动迁移 = `removed-by-decision` | 见 `docs/migration/DEFERRED_CAPABILITIES.md` |
| A8 | 真 Netease provider 集成方式 | 主用 `hana-music-api`（MIT，Bun-native，ESM-first，依赖 hono/music-metadata/qrcode）；回退：`NeteaseCloudMusicApi`（ISC，已在根 `package.json` ^4.32.0）。若手动 WebView2 验证发现 search/songUrl/lyric 行为与 baseline 不一致，切回 NeteaseCloudMusicApi | 用户「换另一个集成方式」+ hana-music-api Bun-native 契合 sidecar 栈；hana 极新（2 stars/v1.1.1）有 parity 风险，回退路径保留 |

## B 类决策（私密/外部资源，发布前收口）

| 编号 | 决策项 | 状态 | 说明 |
| --- | --- | --- | --- |
| B1 | 账号登录凭证 | 用户提供（待注入） | 真实登录/高音质 songUrl 测试用。P4.5/P7 仅做匿名可用路径，`loginStatus/logout` 留 gate；账号测试期由用户私下注入 cookie/QR，不写入仓库 |
| B2 | 签名证书 / 发布密钥 | 不签名 | Tauri updater 资产本次不签名（`TAURI_SIGNING_PRIVATE_KEY` 不配置）；Windows 安装器不代码签名。公开发布前若需签名/校验由用户单独提供密钥 |
| B3 | updater 仓库/外部服务权限 | `github.com/zzstar101/Mineradio` | updater `endpoints` 指向新仓库 Releases；release 上传权限由用户在新仓库配置 |
| B4 | 破坏性清理 | 允许 | 已删 `package-lock.json`。可按迁移计划归档/删除旧 Electron 打包产物等不再使用的文件，但 `public/`、`desktop/`、`server.js` 在 parity 验证完成前仍作 baseline 参考保留 |

## 执行约束（沿用）

- 不在 `main` / `master` / 主工作区 `D:\项目\Mineradio` 直接做长流程实现。
- 不恢复旧 `AI_HANDOFF.md` / `PROJECT_MEMORY.md` / `HANDOFF_NEXT_CHAT.md`。
- 不迁旧 Electron updater / patch JSON / NSIS 发布流程进 Tauri 主线。
- 不承诺旧 Electron 用户数据自动迁移。
- 不用 `public/index.html` iframe/webview 套壳作最终方案。
- 不直接集成 GPL-3.0 不兼容或未审核的 QQ 开源代码。
- 不降低玻璃质感、视觉节奏、3D 歌单架手感或桌面歌词行为。
- 写入仅限全局 worktree 内迁移直接相关路径。