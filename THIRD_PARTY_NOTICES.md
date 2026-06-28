# Third-party Notices

Mineradio Tauri Rewrite 是 GPL-3.0 二开项目。本文件记录 Tauri 迁移主线当前直接依赖和关键技术的用途、license status 与 release gate 备注。最终公开分发状态以 `docs/migration/LICENSE_GATE.md` 为准；这里不会把待审核项目声明为已经最终过关。

## Project Notices

| Item | License status | 用途 | Gate / 风险备注 |
| --- | --- | --- | --- |
| Original Mineradio | GPL-3.0 / original design rights retained by original author | 视觉、行为和能力 baseline；fork 来源说明 | 新 Tauri 主线必须明确二开身份，不得暗示是原 Electron 官方发布线 |
| Mineradio Tauri Rewrite | GPL-3.0 | 本 fork/rewrite 源码和分发授权 | 公开发布前仍需 capability parity、Windows installer/updater 和 license gate 全部完成 |

## Runtime, Desktop And Build Stack

| Item | License status | 用途 | Gate / 风险备注 |
| --- | --- | --- | --- |
| Tauri 2 | 待审核；通常为 MIT/Apache-2.0，需按 `LICENSE_GATE.md` 完成 Rust crate license 核对 | Rust 桌面壳、窗口、命令、sidecar 生命周期和 updater 基础 | 总 license gate 不能关闭，直到 Rust crates 审核完成 |
| @tauri-apps/cli | 通过；MIT/Apache-2.0 | Tauri dev/build CLI | 构建工具；打包产物包含 notices 仍需验证 |
| tauri-build | 待审核；通常为 MIT/Apache-2.0，需按 Rust crate audit 完成核对 | Tauri build script integration | Rust crate audit 未完成前不关闭总 gate |
| tauri-plugin-dialog | 通过；MIT/Apache-2.0 | Rust-owned JSON import/export open/save dialogs | 已记入 license gate；仍需真实 WebView2 手动导入/导出验证后才能勾能力 gate |
| tauri-plugin-global-shortcut | 通过（code-side 接入）；MIT/Apache-2.0 | Rust-owned global hotkey registration and action event bridge | 已记入 license gate；真实 Windows OS 注册冲突和物理按键触发仍需能力 gate 验证 |
| tauri-plugin-updater | 通过（检测接入）；MIT/Apache-2.0 | Tauri updater 检测和签名校验通道 | P10.a 仅完成 code-side detection；pubkey 为空，download/install 仍受签名 gate 阻挡 |
| @tauri-apps/api | 通过；MIT/Apache-2.0 | React 前端调用 Tauri command 的 typed runtime bridge | 前端不暴露 JS updater plugin capability，更新由 Rust command 代理 |
| Bun | 通过；MIT | workspace 包管理、sidecar runtime、测试命令 | 生产 sidecar 打包和分发仍需后续 Windows release 验证 |
| Vite | 通过；MIT | Web app dev/build | 与 Tauri WebView2 打包加载仍需最终 build/install 验证 |
| @vitejs/plugin-react | 通过；MIT | Vite React transform / Fast Refresh integration | 构建工具；打包产物 notices 仍需验证 |
| TypeScript | 通过；Apache-2.0 | shared、web、sidecar 和 visual-engine 类型检查 | 作为构建/类型工具使用 |
| serde | 待审核；通常为 MIT/Apache-2.0，需按 Rust crate audit 完成核对 | Rust command/config serialization | Rust crate audit 未完成前不关闭总 gate |
| serde_json | 待审核；通常为 MIT/Apache-2.0，需按 Rust crate audit 完成核对 | Rust JSON command payloads and config helpers | Rust crate audit 未完成前不关闭总 gate |

## Web And State Stack

| Item | License status | 用途 | Gate / 风险备注 |
| --- | --- | --- | --- |
| React | 通过；MIT | UI shell 和页面组件 | 公开发布前需完成 parity 和 WebView2 手动验证 |
| React DOM | 通过；MIT | React DOM renderer | 同 React |
| @types/react | 通过；MIT | React TypeScript type definitions | Dev dependency |
| @types/react-dom | 通过；MIT | React DOM TypeScript type definitions | Dev dependency |
| Zustand | 通过；MIT | 前端状态管理 | 持久化数据需由 zod 归一化；不读取旧 Electron 用户目录 |
| zod | 通过；MIT | shared API contract、输入输出和持久化 schema | 跨 Rust/Bun/React 的运行时契约 gate 依赖它 |

## Visual Stack

| Item | License status | 用途 | Gate / 风险备注 |
| --- | --- | --- | --- |
| Three.js | 待审核；通常为 MIT，需按 `LICENSE_GATE.md` 引入时再核 | WebGL/3D 歌单架和视觉引擎 | 不能在总 license gate 中声明通过；还需视觉 parity 录屏和 WebView2 验证 |
| @types/three | 通过；MIT | Three.js TypeScript type definitions | Dev dependency |
| GSAP | 待审核；仅标准功能允许，会员/闭源插件禁用 | 动画 timing、控制台动效、歌词舞台和视觉引擎 | 必须确认未打包会员/闭源插件后才能关闭 gate |
| happy-dom | 通过；MIT | visual-engine DOM-like test environment | Dev/test dependency |

## Provider And Music API Stack

| Item | License status | 用途 | Gate / 风险备注 |
| --- | --- | --- | --- |
| hana-music-api | 通过（带 parity 风险）；MIT | Netease provider 主用实现 | 极新且体量小，provider parity 和真实账号态验证仍 pending |
| NeteaseCloudMusicApi fallback | 通过；ISC | Netease provider 回退路径 | 保留原 license 和 notice；真实接口可用性需后续手动验证 |
| qq-music-api (`jsososo/QQMusicApi`) | 通过；GPL-3.0 | QQ provider search/songUrl/lyric/playlist/loginStatus/logout | 与本项目同 GPL-3.0；作为依赖调用，不复制代码；真实账号态和 WebView2 验证仍 pending |

## Service Disclaimer

本项目不是网易云音乐、QQ 音乐或腾讯音乐娱乐集团的官方客户端，也不隶属于任何音乐平台。第三方平台接入仅用于个人学习、本地客户端体验和用户自有账号的播放辅助。请遵守对应平台的用户协议、版权规则和会员权益规则。
