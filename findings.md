<!-- cspell:ignore deepseek Cordis subrequest -->

# Delta Comic 全仓重构：研究与需求发现

## 当前仓库与基线

- 仓库：`/Users/wenxig/Documents/delta-comic`，分支 `develop`；本次开始时工作区干净。
- 参考：`/Users/wenxig/Documents/deepseek-harness`，位于本仓库上一级目录。
- 现有工作区包包括 `app`、`db`、`downloader`、`logger`、`model`、`plugin`、`runtime`、`server`、`server-admin`、`ui`、`utils`。
- `app` 为 Vue/Tauri；`server` 为 Cloudflare Worker/Elysia + D1/Kysely；`server-admin` 为独立 Vue 管理应用，feature 自动发现。
- 现有 plugin 架构已有 composition root、依赖规划、激活流程、PluginScope 清理以及 Vite 原生 HMR。
- 仓库工作规则详见 `AGENTS.md`。核心命令使用全局 `vp`，不直接调用 pnpm、vite、vitest、oxlint、oxfmt。依赖调整后 `vp install`；Web 验证顺序 `vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run`；Rust 验证另行执行 fmt、clippy、test。

## 参考架构发现

DeepSeek Harness 以 capability family 组织 workspace，强调服务定义/提供者/消费者分离、清楚的 package contract/README、模块图和可观测 runtime。其 Cordis 提供 Context、Service、Fiber、Registry、反射及具有 serial/parallel/bail/waterfall 模式的 typed events；Loader 以稳定 id/config/group/disabled/inject 构成 Entry Tree，并管理动态加载/更新生命周期。Delta Comic 的 PluginScope 可作为可逆 effect 管理的参考锚点。

## 已确认的总体目标

- 全仓重构，重新规划架构和代码组织，参照 DeepSeek Harness 的 Cordis/monorepo 思路。
- 所有依赖升级到当时最新版本，允许采用预发布版本。
- 保留现有产品能力；数据库可迁移；既有插件/API 不保证兼容。
- 目标客户端为 Tauri 桌面版与 Tauri 移动版；不再把浏览器 Web 客户端作为产品目标。
- 现有下载器实现复用并按新边界修补，不重写。
- 已有客户端能力需保留：主页、搜索、订阅、收藏、历史、下载、插件列表/市场/安装/配置/日志/云同步。
- 服务端保留 auth/sync/plugins/admin 能力；管理端保留 overview/openapi/observability/plugins/settings 等功能并保持独立应用。

## 包发布与 Cordis

- Cordis 采用上游 npm 包，不维护仓库内 vendored fork。
- 新增 `@delta-comic/both`，作为正式公开包，放平台无关/客户端与服务端共有内容，并统一 re-export Cordis 公共 API及兼容版本约束。
- `@delta-comic/client` 是外部客户端插件开发 SDK；`@delta-comic/server` 是外部服务端插件开发 SDK。
- 当前考虑的包依赖图：`client -> both`、`server -> both`；跨端扩展可以依赖 `both`，客户端插件依赖 client，服务端插件依赖 server。
- 客户端和服务端插件彼此独立：各自 pluginId/version/lifecycle，不因共用核心协议而自动成对安装/部署。
- 初步包路径提议：`packages/client/core/sdk`、`packages/server/core/sdk`（公共包物理目录与 family 分组尚待总体设计确认）。

## 公共协议与客户端插件

- client/server 共用精简 Manifest 核心协议，分别定义平台扩展；常见客户端插件可仅依赖自身云端，不要求 Delta Comic 服务端插件。
- SDK 可提供 Cordis 与核心服务顶层导出，UI/player/model 从稳定子路径导出。
- 用户希望提供受控 UI 扩展：页面/路由、导航项、设置页、命令、首页卡片、详情操作；宿主保留当前视觉风格并负责导航/容器。
- 插件主要以 Vue 组件扩展；结构化声明 UI 仅用于少数需要的场景。插件页挂在 `/plugins/{pluginId}/...`，可以复用宿主完整布局。
- 桌面和移动端共用 Vue/Tauri WebView 组件，支持相同扩展点。
- 插件 CSS 支持 CSS Modules 与作用域选择器；Shadow DOM 仅用于复杂组件。插件组件复用宿主 Vue/UI runtime，避免重复打包。
- 所有客户端插件默认可信、无限权限、不沙箱；既可通过正式 service definitions/typed events 交互，也可直接使用客户端数据库/store；两者共用实现和诊断链。
- 外部内容插件直接依赖 `@delta-comic/client` 使用内置 layout/player/model/component capability，不再声明独立 layout 插件。
- 独立 `/Users/wenxig/Documents/delta-comic-plugin-layout` 的功能要整合进本体：内容布局、阅读器/视频播放器、详情/作者相关交互、收藏等组件能力及 `ContentImagePage`、`ContentVideoPage`、`VideoConfig` 等模型。具体包 family 和模块拆分待确定。
- 一个 manifest 对应一个插件集，统一安装/升级；内置插件源码集成在宿主。
- 开发与正式安装均支持目录来源；开发支持 Vite 原生 HMR 与诊断面板。
- 正式安装输入为包含 manifest 与 bundle 的 ZIP/目录；市场/Git release/private source 统一安装模型，Git 使用预构建 release artifact，不在客户端构建源代码。
- ESM dynamic import 和多 chunk 均支持；manifest 资源逐项声明 MIME、hash、依赖；Loader 将 `delta-comic:` 虚拟模块解析为宿主模块地址，不依赖 browser import map 作为主要方案。
- 更新前检查哈希并准备新版本，校验成功后原子切换；失败时继续运行旧版本。后台检查更新，用户确认后执行更新。
- 插件错误隔离在当前插件，标为 failed/disabled 并展示诊断，宿主继续运行。
- 始终采集生命周期、版本、错误、调用关系元数据；事件参数和业务 payload 默认脱敏或按需开启；正式/开发插件可查看自身诊断。
- 用户明确要求插件用户可见文本允许硬编码并放弃 i18n；适用范围（仅外部插件 manifest/组件，还是内置插件与宿主 UI 文案也覆盖）仍未确定，必须专门澄清。

## 服务端插件与安全模型

- 服务端第三方插件运行期视为不可信代码；Worker for Platforms 动态 dispatch 为主要隔离边界，每个用户安装实例独立 Worker。
- 单个插件可扩展路由、数据库、外部网络、定时任务、后台任务等完整 API 面。
- 每安装实例拥有独立 D1，插件可直接 SQL 访问；与宿主业务 D1 隔离。D1 配额/创建成本/容量上限待设计确认及技术验证。
- 插件可由任意 URL/Git 来源提供，但必须由提交者提供预构建 ESM Worker bundle + manifest，平台不构建源码。
- 安装归属账号/用户级。Manifest 权限自动授权；插件允许任意公网出站请求。
- 宿主验证平台会话，再注入不可伪造的身份上下文（userId、installationId、permissions、request metadata）；插件不能拿到主会话密钥。
- 对外路由在平台域名下统一前缀 `/plugins/{installationId}/...`。
- Manifest 声明路由、插件代码实现 handler。定时任务/后台任务/绑定和请求 lifecycle 等细节待确认。
- 插件启动时执行自己的 D1 迁移。迁移成功后做 Worker 原子切换；失败继续旧 Worker。新 Worker 启动/健康检查失败时当前 installation 进入 failed，保留 D1 供修复，其他实例和平台继续服务。
- 用户说明没有历史服务端部署，服务端业务数据库无需旧数据迁移；此项与未来 per-plugin D1 schema upgrade 属于不同范围。
- 服务端 SDK 依赖 `@delta-comic/both`，平台提供 `@delta-comic/server` 与 Worker runtime；插件 bundle externalize runtime。
- 产物完整性只验证 Manifest 声明的 SHA-256；本轮不建立 publisher signature/公钥体系。

## AI 调试友好

- 目标包括稳定 plugin/installation/service/event/config/fiber/request/job ID，结构化日志、错误上下文、调用链，插件树/依赖图/service registry/event listener/fiber 状态/配置来源等诊断快照。
- 需要考虑最小 runtime harness、事件记录/回放、确定性复现、包 README/边界/配置/排错入口、小模块/明确入口/低隐式行为。
- 采集与隐私需在包设计和运行时统一定义：元数据常态采集，payload 默认隐私保护。

## 已确认的 40 项架构决策

### 1–6: 包与协议

1. **@delta-comic/both 职责** (1A): 导出 Cordis 公共 API、核心 Manifest schema、ID/诊断/版本声明等平台无关内容。
2. **Cordis 依赖统一** (2A): @delta-comic/both 依赖并统一 re-export Cordis，三个公共包锁定同一 Cordis 版本。
3. **Manifest 文件拆分** (3B): client/server 各自独立 Manifest 文件，共用 schema 基础类型。
4. **两端独立构建** (4A): 客户端与服务端分别构建/安装/升级，允许同一 pluginId 语义关联。
5. **生命周期独立** (5A): 两端生命周期完全独立，可选通过 integrationId/links 字段表达关联关系。
6. **协议版本检查** (6A): Manifest 携带 protocolVersion，SDK 声明支持范围，安装前兼容性检查。

### 7–12: 模块与构建

7. **客户端入口** (7A): 客户端插件默认导出 Cordis plugin/plugin set，manifest 声明入口类型。
8. **服务端入口** (8A): 服务端插件默认导出 Cordis plugin/plugin set，Worker runtime 注入服务。
9. **模块加载方案** (9C): 用户质疑虚拟模块方案；确认现有 Blob URL + dynamic import 方案 (StoredPluginModuleReader 创建 blob URL、DevServerPluginModuleReader 直接 import Vite dev server) 可继续使用，暂不强制虚拟模块。
10. **待定** (10): 依赖第 9 项决策后再讨论。
11. **待定** (11): 依赖第 9 项决策后再讨论。
12. **待定** (12): 依赖第 9 项决策后再讨论。

### 13–18: 客户端 API

13. **UI 扩展注册** (13A): 插件通过 service API 注册 UI，组件由 Vue API 提供。
14. **路由与导航** (14A): 插件声明 route，宿主生成 /plugins/{pluginId}/... 及导航项。
15. **数据库/store 全量访问** (15A): 通过 typed API 暴露全部表/store，每次调用接入诊断链。
16. **双模式数据存储** (16D): 同时支持 plugin-scoped namespace/API (宿主管理) 与插件自建表+迁移。
17. **双模式配置** (17C): 支持宿主托管配置与插件自管配置，宿主配置可映射为插件服务。
18. **停用语义** (18A): 停用时停止 fiber、卸载 UI、保留数据，支持重启。

### 19–26: 服务端

19. **默认鉴权路由** (19A): 默认路由要求宿主会话并注入身份，Manifest 可声明公开路由。
20. **路由声明与实现** (20A): Manifest 声明 method/path/权限，插件通过 typed router service 提供 handler。
21. **任务声明与调度** (21A): Manifest 声明 cron/queue/job，插件提供 typed handler，平台调度。
22. **迁移携带与执行** (22A): artifact 携带有序 SQL migration 与版本表，Worker runtime 切换前执行。
23. **迁移状态追踪** (23A): 安装实例记录 migration id、日志、错误、版本，支持重试/修复。
24. **配置来源** (24B): 所有配置由 Manifest 默认值提供 (非用户配置+secret service)。
25. **资源配额声明** (25A): 平台定义基础上限，Manifest 可声明所需，安装时校验。
26. **超限处理** (26A): 超限时当前请求/job 失败并产生诊断，平台保留安装实例。

### 27–35: 安装/诊断

27. **产物布局** (27B): 布局自由，Manifest 完整列出路径 (非固定布局)。
29. **版本选择** (29A): 按 semver/protocol/capability/变体选择候选版本。
30. **来源凭证** (30: A+C): 宿主保存来源级凭证引用 (A) + Manifest 自带访问凭证 (C)。
31. **诊断数据持久化** (31A): 内存保留近期，本地持久化摘要；服务端保存服务端摘要；用户补充"为减轻服务器压力，非主动不上传"。
32. **诊断采集粒度** (32B): 默认完整记录 (非默认元数据+脱敏 payload)。
33. **诊断可见性** (33B): 插件可读全局注册表和其他插件诊断 (非只读自身)。
34. **运维操作** (34A): 提供重启/停用/重试迁移/切换版本/导出诊断/删除等明确操作。
35. **宿主日志权限** (35: A 内容 B 权限): 插件读取自身结构化日志/trace/错误 (A 的内容范围)，宿主日志脱敏引用暴露 (B 的权限约束)。

### 36–40: 应用/文案/发布

36. **跨端依赖** (36A): 允许协议工具/跨端类型/跨端插件依赖 both；平台插件分别依赖对应包。
37. **i18n 全局例外** (37: 自定义): 用户指定"不加入 i18n，只硬编码，不需要列出语言"，意为放弃多语言、全部硬编码，不区分外部/内置 (与之前 37A 仅外部插件例外不同，此次明确全局例外)。
38. **UI/player 导出路径** (38A): layout/player/model 从 @delta-comic/client/ui、/player、/model、/layout 等稳定子路径导出。
39. **依赖统一升级** (39A): workspace/Tauri/Rust/Cloudflare/构建链统一升级并锁定，分阶段验证。
40. **分阶段实施** (40A): 先完成 both/client/server SDK、最小 Cordis runtime、客户端/服务端示例、artifact 校验、诊断快照，再迁移完整能力。

## 剩余未决问题

1. 客户端完整数据库/store 插件直访 API 的稳定性、事务/表访问接口、插件数据命名空间、数据库迁移/权限与诊断语义。
2. Cordis loader 模型 (Entry/EntryTree、依赖、分组、注入、配置验证、并发/顺序启动、事件派发) 及服务端/客户端差异。
3. Tauri mobile 能力差异：下载器原生桥接、文件/网络/权限/后台任务、插件 HMR/debug 仅开发模式或设备端均可用。
4. 服务端 Worker 路由 handler 细节、HTTP methods/path matching/middleware、权限声明、登录验证上下文、CORS/请求体/响应限制。
5. 服务端 Cron/队列/后台任务细节、D1 migration transactional/idempotence、插件的 fetch-to-self/子请求、secrets 与不可变绑定注入规则。
6. Workers for Platforms/D1 额度：每用户实例上限、数据库尺寸、CPU/subrequest/请求并发/存储、平台总体容量与超限策略；需依据 Cloudflare 当前官方文档做技术校验。
7. 目录/ZIP 安装归档的精确布局、资源路径/动态 chunk 加载、路径遍历防护、MIME 支持和平台/架构变体。
8. Git release artifact 与市场格式、更新策略 (版本选择/兼容约束/更新失败恢复)、私有源身份凭证存储和拉取策略。
9. 内置插件与外部插件的源码/构建/类型共享方式，生成插件模板、第三方开发工具/CLI、宿主发布时 runtime externalization 和可测试 harness。
10. AI 诊断面板/事件回放的保存位置、保留期、调试时 payload 捕获的显式开关/权限、用户数据访问审计策略。
11. 应用/服务端/admin 的新 package families、目标支持环境、哪些目前非用户可见的功能应保留或删除。
12. 依赖升级范围 (workspace dependencies、Tauri/Rust crates、移动端插件、构建工具、Cloudflare bindings) 和升级版本锁定/可复现规则。
13. i18n 全局例外的精确边界 (是否覆盖所有 UI 文案、错误消息、日志)，以及现有 AGENTS i18n 约定需要如何在设计/后续项目文档中明确该例外。

## 设计大纲（草案）

1. 目标、非目标与架构不变量
2. 总体运行时拓扑与信任边界
3. Capability-family workspace 与包职责/发布面
4. Cordis、Loader 与公共 `@delta-comic/both` 协议
5. 客户端 SDK、扩展点、内置 UI/layout/player/model 和 Tauri 宿主
6. 服务端 SDK、Worker runtime、路由/任务/D1 生命周期
7. Manifest、产物格式、安装/升级与模块解析
8. 安全、权限、资源配额、隐私与故障隔离
9. AI diagnostics、结构化日志、snapshot、事件记录/回放
10. 应用/server/admin 重组及数据模型
11. 依赖升级、发布/版本协同、验证及回滚策略
12. 分阶段迁移与可交付结果

## 外部技术验证边界

- 进入设计定稿前，根据 Cloudflare 当前官方文档验证 Workers for Platforms 动态 dispatch、D1 per-isolate/每实例绑定、Worker 资源限制、队列/cron 等本项目选用产品的当前能力及限制。
- 对 Cordis、Loader、Vite/Rollup/Tauri/Cloudflare SDK 的 API 讨论必须按当前版本查阅对应官方文档或代码，不以预训练知识作为最终实现规范。
