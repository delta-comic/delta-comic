# 下载器验收清单

## HTTP 故障矩阵

- 标准 `206` 与并行 Range。
- `Content-Range` 起点早于或晚于请求起点。
- 忽略 Range 并返回 `200`。
- `416`、响应体超出声明区间、未知长度与中途断流。
- ETag 或 Last-Modified 改变时拒绝拼接旧数据。
- 无验证器时用持久化采样摘要确认已有区间。
- 任务进程被强制终止后，只重新请求缺失区间，最终文件逐字节一致。
- SHA-256 与 MD5 成功、失败和重新校验。

## 调度与资源

- 活动任务配置边界为 1 和 20。
- 相同优先级遵循队列位置，不同优先级以 10 为最高。
- 连接预算在 1/4/8/16 分片和 1–20 个任务下均不被突破。
- 慢尾分片仅在 worker 已运行 2 秒、剩余至少 8 MiB 且有连接预算时拆分；同一任务
  每秒最多重平衡一次。
- 进度事件不超过 4 Hz，状态变更立即发出。

## BitTorrent

- magnet、torrent URL 与 torrent 字节输入。
- 文件筛选、暂停、恢复与 fast-resume。
- 下载完成默认立即停止上传。
- 分享率、做种时长和“任一条件达到”策略。
- SQLite 任务与磁盘/协议恢复状态不一致时可安全重建。

## 平台

- macOS 与 Windows 使用系统 Downloads，活动下载时关闭窗口进入托盘。
- Android API 26–33 使用前台 WorkManager；API 34+ 使用 UIDT Job。
- Android 通知暂停/取消、断网、`onStopJob`、进程重建和非计费网络策略。
- SAF 当前以应用私有 staging 完成并校验，再通过持久 URI 授权导出；可 seek 文件描述符
  的直接分片写入仍属于后续真实 provider 兼容性优化，不能用 staging 测试替代验收。

## 性能基线

`downloader-performance-baseline` 使用本地 Range 服务驱动真实 Tauri 插件、Engine、SQLite
和 reqwest 路径，输出机器可读 JSON。它必须通过 `DOWNLOADER_BENCHMARK_ENABLE=1`
显式开启，并受 `DOWNLOADER_BENCHMARK_MAX_TOTAL_BYTES` 限制。

对 10 GiB 文件记录 1/4/8/16 分片吞吐、峰值常驻内存、CPU、响应并发与 SQLite 体积；
1–20 任务矩阵应分批运行，避免把每个 case 的总字节数误叠加成超大流量。后续吞吐回退
超过 10%，或内存随文件大小线性增长，均视为验收失败。本轮仅运行轻量 smoke baseline，
不把它冒充 10 GiB 正式基线。

## 当前开发机测试边界

- 允许并执行 Web/Vitest 与 macOS 桌面构建测试。
- 不启动 Android 模拟器或真机，使用 Android JVM 单元测试、lint、AAR 构建、Rust/JNI
  契约测试和故障注入测试替代日常回归。
- Windows MSVC、Android 真机后台限制、系统强制停止和不同 SAF provider 的行为仍需在
  发布候选版本阶段做真实平台验收。
