# MineRadio 三版本性能开销对比

生成时间: 2026-07-02T08:38:52.997Z

## 版本

| 版本           | Ref     | 量测路径                                                                         |
| ------------ | ------- | ---------------------------------------------------------------------------- |
| Electron 原项目 | 6b13010 | C:\Users\zhanw\AppData\Local\Temp\mineradio-perf-worktrees\electron-original |
| Tauri 优化前    | 9d590d2 | C:\Users\zhanw\AppData\Local\Temp\mineradio-perf-worktrees\tauri-baseline    |
| Tauri 当前优化版  | 70182e9 | C:\Users\zhanw\AppData\Local\Temp\mineradio-perf-worktrees\tauri-optimized   |

## 初始页面负载 (Electron 离屏窗口，同 1280x720)

| 版本           | DOM 节点 | JS Heap MiB | Electron RSS MiB | CPU % | 导航 ms | 资源数 |
| ------------ | ------ | ----------- | ---------------- | ----- | ----- | --- |
| Electron 原项目 | 1243   | 12.1        | 487.7            | 0.27  | 658.1 | 9   |
| Tauri 优化前    | 712    | 14.4        | 504.4            | 0.22  | 197.4 | 8   |
| Tauri 当前优化版  | 712    | 14.7        | 513.1            | 0.23  | 208.1 | 8   |

当前优化版相对 Tauri 优化前: 初始 JS Heap 变化 +2.0%，Electron RSS 变化 +1.7%，CPU 样本变化 +7.7%。
当前优化版相对 Electron 原项目: 初始 JS Heap 变化 +21.0%，Electron RSS 变化 +5.2%，CPU 样本变化 -14.8%。

## Tauri 热点渲染开销

| 场景         | 优化前 rows | 优化后 rows | rows 下降 | 优化前 DOM | 优化后 DOM | DOM 下降 | CPU ms 变化 | Wall ms 变化 |
| ---------- | -------- | -------- | ------- | ------- | ------- | ------ | --------- | ---------- |
| 队列面板 240 首 | 240      | 13       | 94.6%   | 2659    | 162     | 93.9%  | -88.0%    | -70.8%     |
| 歌单详情 600 首 | 600      | 15       | 97.5%   | 3039    | 114     | 96.2%  | -100.0%   | -78.2%     |
| 迷你队列 240 首 | 240      | 12       | 95.0%   | 2034    | 210     | 89.7%  | -68.1%    | -82.8%     |

## Depth / 轮询 / 构建产物

| 指标                           | 优化前      | 优化后      | 变化        |
| ---------------------------- | -------- | -------- | --------- |
| depth 单次构建大 Float32Array 次数  | 6        | 3        | 50.0%     |
| depth 单次构建大 Float32Array MiB | 1.50     | 0.75     | 50.0%     |
| 隐藏稳定 sidecar 轮询间隔 ms         | 24000    | 60000    | 150.0% 间隔 |
| 隐藏稳定 sidecar 轮询频率            | 2.50/min | 1.00/min | 60.0%     |
| 前端产物总 MiB                    | 1.58     | 1.59     | +0.4%     |
| 前端 JS MiB                    | 1.48     | 1.48     | +0.4%     |

## 结论

- 当前优化版在大列表渲染上收益最明显: 队列 rows 下降 94.6%，歌单详情 rows 下降 97.5%，迷你队列 rows 下降 95.0%。
- Depth 构建单次大 scratch 分配从 6 次降到 3 次，单次大数组分配下降 50.0%。
- 隐藏且 ready 的 sidecar 状态轮询频率从 2.50/min 降到 1.00/min，稳定后台轮询下降 60.0%。

## 下一步优化方向

- 把歌词/搜索结果/播客列表也接入同一个 virtual-list helper，尤其是长搜索结果和播客节目列表。
- 将 cover depth 的 3 个 scratch buffer 做成 per-worker/per-controller 复用池，进一步减少连续切歌时的 GC 压力。
- 给 AI depth 增加尺寸/来源维度的 LRU 和失败冷却，避免同封面不同 URL 参数重复估计。
- 加一个 CI 可跑的轻量 perf budget，只检查 DOM rows、depth 大数组次数、关键 bundle size，避免性能回退。

## 限制

- 初始页面负载使用同一个 Electron 离屏窗口加载三版页面，适合比较前端页面负载，不等价于最终 Tauri/WebView2 发布包的完整桌面进程占用。
- 热点渲染开销只对 Tauri 优化前后同组件同输入比较；Electron 原项目是单文件前端，无法和 React 组件做一一对应挂载量测。
- CPU 样本是短窗口采样，绝对值会随机器后台负载波动，重点看同机同脚本的相对变化。

