# 原生 Cordis 与 JSON 流程验收

日期：2026-10-02。实现与测试以当前仓库为准。

## 行为覆盖

- 客户端安装模块验证函数数组、资源完整性、模块图和 CSS 生命周期。
- 客户端宿主测试覆盖逆序服务依赖、提供者停用与恢复、原生 Config、失败整组清理、逐个恢复和热更新资源释放。
- 安装元数据无效时按包 ID 展示，加载错误进入本次安全模式；管理页面可以停用该记录。内置包 ID 保持宿主身份。
- JSON 流程测试覆盖条件、输入/配置/结果引用、HTTP 超时、步骤/分支/HTTP 限制和失败步骤记录。
- 真实本地 D1 集成覆盖在线更新下一次调用生效、并发租户与插件键隔离、原子领取、流取消释放及查询预算。
- Web 自动进入首页；真实 ZIP 验证安装、热替换失败、整组清理、启用保存值和界面逐个恢复。更新至 2.0.0 后卸载成功，内置 core 保持 ACTIVE。
- 390px Web 页面布局正常；Tauri 显示单个 800x600 主窗口并自动进入首页，安全模式管理页展示保存值、FAILED/DISPOSED 状态和错误来源。

## 免费计划预算

官方限制核对于 2026-10-02：

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)：免费计划每次调用 CPU 10 ms、50 次子请求、128 MB 内存，每日 100,000 请求。
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)：免费计划每次调用最多 50 条查询，单数据库 500 MB。
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)：每日 5,000,000 读行、100,000 写行。
- [CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/)：CPU profile 用于定位应用执行开销。

手动执行预留认证的 3 条查询，流程预算为 47 条，其中安装读取和执行记录写入占 4 条。存储步骤消耗剩余预算，超限时记录失败步骤。定时调用共用 50 条 D1 查询和 50 次 HTTP 预算，每次原子领取一个任务，余下任务保持到期状态。单流程继续限制 64 步、分支深度 16、16 次 HTTP 和每次 HTTP 10 秒超时。

## 资源测量

测量入口：`packages/server/core/server/test/performance/flow.test.ts`。使用生产 FlowService、Miniflare/workerd、本地真实 D1 和本地 HTTP 服务。每场景预热 5 次，连续测量 30 次，CPU profiler 采样间隔 1,000 微秒。schema 使用预编译 TypeBox validator。

复测命令：

```sh
FLOW_PROFILE_DIR=/tmp/delta-comic-flow-profiles vp test run packages/server/core/server/test/performance/flow.test.ts
```

2026-10-02 18:46 的平均值：

| 场景 | 应用 JS 采样 ms | 全部活跃采样 ms | 墙钟 ms | D1 查询 | 读行 | 写行 | HTTP |
|---|---:|---:|---:|---:|---:|---:|---:|
| return | 6.596 | 9.540 | 9.398 | 4 | 5 | 4 | 0 |
| condition/store | 7.301 | 11.361 | 11.976 | 6 | 7 | 5 | 0 |
| HTTP/store | 8.098 | 11.607 | 12.622 | 5 | 6 | 5 | 1 |

D1 查询数包含流程安装读取和执行记录写入；认证另有 3 条查询。应用 JS 采样按 `worker.js` 归属统计，全部活跃采样包含模拟基础设施、native、未归属样本和 GC。入口测量覆盖流程服务，Elysia 与认证 CPU 需要部署环境继续测量。

本地样本的 D1 和 HTTP 开销符合调用预算。部分全部活跃 CPU 样本超过 10 ms，生产免费计划 CPU 验收仍待部署测量。原始 JSON 和 CPU profile 保存在 `/tmp/delta-comic-flow-profiles`，复测可通过环境变量指定保存目录。

上述场景每次写入 4 至 5 行，在每日 100,000 写行预算下约对应 20,000 至 25,000 次执行；认证、其他业务和安装更新也共享每日预算。定时频率需结合租户数量与实际每日用量设置。

## 最终检查

IndexedDB 文件删除修正后的最终串行验收于 19:14 完成，全部通过：`vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run`（155 files / 833 tests）、`vp run codegen:check`、`git diff --check`。

Rust `cargo fmt --all --check`、全工作区 clippy（含 all-targets、locked、-D warnings）及工作区测试通过，共 132 单元测试；1 个既有文档示例跳过。

实际启动复核中修复了安装元数据展示和 IndexedDB 文件删除；最终浏览器无运行错误。现场警告包含框架实验性提示和浏览器剪贴板权限提示；原生下载器 DHT bootstrap 在当前网络下重试。

本轮实现按阶段签名提交，现场修正与验证同步保存。临时 Web 验收包已卸载，原生调试进程已结束。Web 截图与日志保存在 `/tmp/delta-comic-playwright-final-20261002`。
