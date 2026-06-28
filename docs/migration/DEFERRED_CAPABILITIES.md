# Deferred Capabilities

更新时间：2026-06-28

迁移允许内部里程碑分阶段完成，但最终对外发布必须具备原项目完整能力。任何延期功能都必须在这里追踪，不允许无记录丢弃。

`docs/migration/plans/11-final-baseline-parity.md` 是当前最终 parity 收口计划。本文只允许记录可隔离的边缘能力、已锁定隐藏入口或已锁定移除项；不能把发布前必须完成的主链路能力整体放进 deferred。

## 状态定义

- `active`：当前迁移阶段要完成。
- `deferred`：允许后续阶段完成，但发布前必须决策。
- `hidden`：实现前在新项目中隐藏入口。
- `removed-by-decision`：经用户明确批准后移除。
- `done`：已迁移并通过验收。

## 延期清单

| Capability | Status | 延期原因 | 补齐条件 | 发布前决策 |
| --- | --- | --- | --- | --- |
| Wallpaper Engine 深联动 | hidden | DECISIONS.md A7 已锁定发布前隐藏入口；深联动需要单独协议和打包验证，本阶段不实现 | 独立设计 Wallpaper Engine web 壁纸包和本地桥接方案后再开放入口 | 隐藏，除非后续阶段补齐并验收 |
| 实验壁纸模式 | hidden | DECISIONS.md A7 已锁定发布前隐藏入口；Windows WorkerW、WebView2 层级和穿透风险高 | Tauri 窗口层级、WorkerW 挂载和性能验证通过后再开放入口 | 隐藏，除非后续阶段补齐并验收 |
| 手势识别/hand-canvas | hidden | DECISIONS.md A7 已锁定发布前隐藏入口；不是核心播放闭环，高风险且依赖视觉性能 | React/visual-engine 稳定后迁移并验证摄像/手势开关后再开放入口 | 隐藏，除非后续阶段补齐并验收 |
| 旧 Electron patch JSON 系统 | removed-by-decision | Tauri updater 替代旧 patch 系统，二开项目不兼容旧更新通道 | 无 | 不进入 Tauri 主线 |
| 旧用户数据自动迁移 | removed-by-decision | 本项目为二开项目，不承诺读取旧安装用户数据 | 无 | 不进入 Tauri 主线 |
| QQ 独立 sidecar | deferred | 第一版先用一个 Bun API sidecar 内部 provider adapter | QQ provider 复杂到影响主 sidecar 稳定性时拆分 | 视实现复杂度决定 |
| Tauri 发布 logo / 最终品牌名 | done | DECISIONS.md A1/A2 已锁定 app id `com.mineradio.fork.tauri`、productName `Mineradio Tauri Rewrite`，并复用 Electron baseline `build/icon.ico` 作为最终发布 logo | 无 | 见 DECISIONS.md A1/A2；由 `npm run release-identity:check` 防回退 |
| Tauri dev 期占位图标 | done | `apps/desktop/src-tauri/icons/icon.ico` 复用 Electron baseline `build/icon.ico`，按 `docs/migration/DECISIONS.md` A2 已定为最终发布 logo | 无 | 见 DECISIONS.md A2 |

## 管理规则

- 新增延期项必须写明原因和补齐条件。
- 发布前所有 `deferred` 项必须变成 `done`、`hidden` 或 `removed-by-decision`。
- `removed-by-decision` 必须来自用户明确同意。
- 视觉、播放、provider、桌面歌词、updater、license gate 不能作为整体延期项。
- 发布前不能整体延期：启动/Home shell、搜索、播放、队列、歌词、provider adapter、Netease/QQ 核心接口、视觉 parity、3D 歌单架、桌面歌词、Windows 安装/卸载、Tauri updater/release path、license/notices gate。
- 发布前允许保持非 `done` 的只有已锁定处置项：A7 的 Wallpaper Engine 深联动 / 实验壁纸模式 / hand-canvas 为 `hidden`，旧 Electron patch JSON / 旧用户数据自动迁移为 `removed-by-decision`。
- `QQ 独立 sidecar` 只是进程边界决策，不是 QQ provider 功能延期；发布前必须决定继续单 Bun sidecar、拆独立 sidecar，或将该项改为 `removed-by-decision`，但 QQ search/songUrl/lyric/playlistDetail/loginStatus/logout parity 仍必须由 capability gate 验收。
- `Tauri 发布 logo / 最终品牌名` 已按 DECISIONS.md A1/A2 改为 `done`；不得因品牌项未更新而阻塞或改变已锁 app id/productName/logo 决策。
