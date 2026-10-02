<!-- cspell:ignore deepseek Cordis subrequest specta -->

# Delta Comic 全仓重构：研究与需求发现

## 阶段 8/9 当前基线（2026-10-01）

- `@delta-comic/both` 已有容量受限 `DiagnosticRecorder`、`withDiagnostic`、装饰器、Cordis runtime 快照以及日志回放 harness，但 snapshot 只有插件与记录两类数据。
- `PluginScope` 当前只管理 disposer 和 AbortSignal，缺少安全调用、失败状态与诊断绑定。
- 客户端和服务端 runtime 已把诊断记录接入 DB、store、网络、下载器、路由与任务，但插件失败隔离和丰富运行时实体快照仍需补齐。
- 服务端 Worker provisioner 已传递 CPU/subrequest 限制，默认值为 50/50；第 8 章要求同时声明内存限制并将默认 subrequest 收敛到 10。
- 共享 `@delta-comic/logger` 已提供跨 Web/Tauri 的结构化日志传输与序列化，适合作为诊断日志出口，避免再引入重复日志基础设施。

## 当前仓库与基线

- 仓库：`/Users/wenxig/Documents/delta-comic`，分支 `develop`；本次开始时工作区干净。
- 参考：`/Users/wenxig/Documents/deepseek-harness`，位于本仓库上一级目录。
- 现有工作区包包括 `app`、`db`、`downloader`、`logger`、`model`、`plugin`、`runtime`、`server`、`admin`、`ui`、`utils`。
- `app` 为 Vue/Tauri；`server` 为 Cloudflare Worker/Elysia + D1/Kysely；`admin` 为独立 Vue 管理应用，feature 自动发现。
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
- 已确认包路径采用 `packages/*/*/*`，当前公开 SDK 位于 `packages/client/core/sdk` 与 `packages/server/core/server`；能力域继续按 client/server/shared family 组织。
- 目录稳定化已完成：workspace 只使用 `packages/*/*/*`，当前 13 个包分别位于 `client/app/app`、`client/core/{runtime,sdk}`、`client/data/db`、`client/platform/downloader`、`client/ui/ui`、`server/admin/admin`、`server/core/server`、`shared/core/{both,logger,model,utils}`、`shared/plugin/plugin`。后续新包必须落入三级路径，并以实际能力命名第二、三级目录。
- 参考 DeepSeek Harness 的组织方式，后续 Cordis 拆分按独立包边界推进：协议、Manifest、Artifact、Loader、Install、Runtime、Vite adapter、release 与平台宿主分别拥有独立 package contract；聚合包只承担兼容导出和组合，不承载多个无关生命周期。

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
9. **模块加载方案** (9C): 用户质疑虚拟模块方案；确认现有 Blob URL + dynamic import 方案 (StoredPluginModuleReader 创建 blob URL、DevServerPluginModuleReader 直接 import Vite dev server) 可继续使用，不引入虚拟模块解析层。
10. **宿主 external 版本协商** (10: 修改版 D): 按依赖类型分别制定规则——平台 SDK (@delta-comic/*) 和 Cordis 由插件构建时 externalize，运行时宿主注册为全局模块；UI 库 (Vue/Naive UI) 客户端插件 externalize、宿主注册；其他依赖插件自行打包。
11. **资源依赖声明** (11A): 每个资源 (包括 dynamic import chunk) 在 Manifest 声明 path、mimeType、integrity (SHA-256)、imports (依赖资源列表)、可选 platform 条件；构建工具生成完整资源清单。
12. **内置与外部插件构建** (12A): 同一套 SDK/Manifest/Loader 合约；内置插件源码直接参与宿主构建 (Vite monorepo)；外部插件产出 ESM bundle + Manifest + 资源清单 ZIP。

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

## 补充决策：模块加载细节 (9-12)

用户后续补充确认了模块加载机制的 4 项细节 (9C-12)：
- 保留现有 Blob URL + dynamic import，不引入虚拟模块。
- 宿主通过全局模块注册方式 (window/globalThis) 提供 externalized SDK/Cordis/UI 库。
- Manifest 完整声明资源依赖图 (包括 dynamic chunk)。
- 内置/外部插件统一构建合约。

## 补充决策：移动端平台范围

- **只支持 Android**，不考虑 iOS 开发。
- 移动端采用 Tauri 移动端方案（Android WebView + Rust 后端）。
- WebView 能力：Chrome 内核，要求 Android 7+。

## 补充决策：数据库访问方式

- **默认使用 ORM（Kysely）而不是直接编写 SQL**，除非极端性能场景或 ORM 无法表达的查询。
- 客户端与服务端统一使用 Kysely，类型安全的 query builder。
- 插件也通过 Kysely API 访问数据库，宿主提供 typed DB instance。
- 数据库迁移使用 Kysely Migrator 或等价工具，避免手写 DDL 字符串。

## 补充决策：依赖版本策略

- **包都走前沿路线**，使用最新 RC/beta/canary 版本，不考虑插件适配问题或生态稳定性。
- **Vue 使用 RC 版本和 Vapor 模式**：采用 Vue 3.5+ RC 最新版本，启用 Vapor 编译模式（实验性）。
- 其他依赖也优先 latest/next/canary channel，拥抱新特性和性能优化。
- 插件作者需跟随宿主依赖版本，不保证向后兼容旧版本依赖。

## 补充决策：Tauri 性能优化

- **Custom Protocol 传输二进制数据**：图片/下载内容等二进制通过 `tauri://` 自定义协议传输，避免 JSON 序列化/base64 编码（阻塞 JS 线程）。
- **树摇优化 + 代码分割**：Vite 默认支持，确保 `package.json` 正确配置 `sideEffects`，可减少 50-70% bundle 大小。
- **Rust 二进制优化**：使用 `lld` 链接器加速构建，strip symbols、LTO 优化。
- WebView 使用系统 JS 引擎（V8/JavaScriptCore），无字节码编译 API，主要优化点在减少 IPC 调用和二进制传输。

## 补充决策：网络插件内化

- **`tauri-plugin-better-cors-fetch` 内化到项目**：当前外部依赖（版本 1.8.0），需内化到 `packages/network` 进行定制。
- 内化路径：`packages/network`（Rust crate + npm 包），与 `db`/`downloader`/`logger`/`plugin` 同级。
- 保留现有功能：multipart、blocking、CORS bypass。
- 定制方向：与 Cordis 集成、诊断日志、请求拦截/重试/缓存、插件 API 暴露。

## 补充决策：类型系统与 specta

- **specta 是整个架构的类型基础设施**，不只是 Tauri IPC 的配角，而是实现"单一类型源派生多端类型"的核心工具。
- **单一类型源派生策略**：Rust 定义一次（struct/enum + `#[derive(specta::Type)]`），自动生成 TypeScript/JSON Schema/OpenAPI 等目标类型，避免手动同步跨语言定义。
- **具体应用场景**：
  1. Tauri IPC 类型安全：Rust 命令通过 `#[specta::specta]` 生成 TS 绑定，前端 `invoke` 端到端类型检查。
  2. 跨端模型统一：PluginManifest/PluginConfig 等共享模型在 Rust 定义，派生供前端/Worker/admin 使用。
  3. Manifest/配置校验：从 Rust 类型生成 JSON Schema，用于安装时校验插件 artifact。
- 保证客户端/服务端/配置/文档的类型一致性，消除跨边界运行时类型错误。

## 补充决策：Cordis-first Loader 与依赖策略

- **插件间依赖通过 Cordis Context 与 TypeScript Module Augmentation**：插件 A 通过 Cordis Service 暴露能力并扩展 Context 接口，插件 B 通过 `export const inject` 声明依赖，TypeScript 类型安全由模块扩展保证。
- **Loader 基于 Cordis 机制**：Delta Comic Loader 只负责从 artifact 读取代码、解析 Manifest 元数据，将插件模块交给 Cordis Registry；依赖解析、激活顺序、循环检测、卸载清理全部由 Cordis 自动处理。
- **Manifest dependencies 字段用于安装时校验**：确保依赖插件已安装且版本兼容，不参与运行时加载顺序（运行时由 Cordis inject 决定）。
- 客户端与服务端统一使用 Cordis Context/Registry/Service/Events，插件代码无需区分平台差异的依赖管理逻辑。

## 架构原则：文件职责单一化

- **多拆分文件，一个文件职责清晰单一**，避免写出过大文件（如单文件超 300 行、单一模块包含多个不相关职责）。
- 按功能/职责拆分模块，每个文件应有明确的单一目的（一个 Service、一个 API 集合、一个类型定义文件）。
- 优先小而聚焦的模块，便于理解、测试、维护和 AI 调试。

## 架构原则：优先使用成熟库

- **优先找库而不是造轮子**，特别是基础设施功能（日志、序列化、验证、HTTP 客户端等）。
- 选择标准：活跃维护、TypeScript 支持、性能良好、社区认可。
- **日志库选择**：
  - 客户端：**tslog**（v5），支持浏览器 + Node.js + Deno，TypeScript 原生，结构化 JSON 输出
  - 服务端：**pino**，Worker 环境高性能，JSON 结构化日志，生态成熟

## 剩余未决问题

1. 宿主全局模块注册的具体 API 形态：是 `window['@delta-comic/client']` 直接挂载导出对象，还是通过 `System.register` 或其他模块加载器？需确认浏览器/Worker 两端的统一机制。
2. 客户端完整数据库/store 插件直访 API 的稳定性、事务/表访问接口、插件数据命名空间、数据库迁移/权限与诊断语义。
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

## 2026-09-27：阶段 6G 第一批协议包

- Manifest、artifact 和 platform-neutral plugin API 已从 `@delta-comic/both` 拆分为独立公开包：`@delta-comic/plugin-manifest`、`@delta-comic/plugin-artifact`、`@delta-comic/plugin-api`。
- 现有 client SDK、server SDK 和 artifact reader 已迁移到新包；`@delta-comic/both/manifest` 与 `@delta-comic/both/artifact` 路径已移除。
- 发布 workspace 测试需要覆盖三个新包及其按依赖拓扑排序的构建顺序；loader、install、runtime、Vite adapter 等后续 6G 包继续保留为未完成事项。

## 2026-09-27：阶段 6G 拆包设计结论

- 目标公开包为 `@delta-comic/plugin-kernel`、`@delta-comic/plugin-loader`、`@delta-comic/plugin-runtime`、`@delta-comic/plugin-install`、`@delta-comic/plugin-vite`，现有 `@delta-comic/plugin` 收敛为聚合与 concrete composition 包。
- Kernel 负责 source-agnostic candidate/provider/dependency/capability/contribution/scope；Loader 负责模块加载契约与通用 helper；Runtime 负责生命周期引擎；Install 负责 provider-neutral 安装端口和流程；Vite 包负责构建、ZIP、host externals 与原生 HMR/CSS bridge。
- Runtime 不依赖 install、数据库或 Tauri；具体 DB、市场、文件存储和宿主服务 adapter 保留在 composition。所有包禁止反向依赖聚合包，入口文件保持 export-only，concrete assembly 集中于 composition。

## 2026-09-27：6G 实施计划核查

- 当前聚合包构建入口同时打包 `lib/index.ts` 与 `vite/index.ts`，应用 `@` alias 指向 `lib`；新包需各自维护独立 Vite+ pack/typecheck/test 配置，并在 workspace build 拓扑中声明依赖。
- Kernel 与 Runtime 的 index 已是纯 re-export，适合按目录整体迁移；聚合包暂时保留原入口，待新包构建稳定后改为依赖新包并集中 concrete assembly。
- 当前实施计划分为 Kernel/Loader、Runtime、Install、Vite、聚合包收敛和最终验证六阶段；每阶段记录专项构建、类型检查与测试结果。

## 2026-09-27：6G-1 Kernel/Loader 实施边界

- Kernel 的 candidate 类型需要脱离旧聚合 API/model 依赖，改用新 Manifest 包与 platform-neutral config contract；实现保持 source-agnostic。
- Loader 提供 `LoadedPluginModule` 与 `PluginModuleReader` 契约及通用模块读取类型；具体 ZIP stored reader、dev-server reader 和文件存储仍留在 Install/composition。
- 新包入口仅 re-export；旧 `@delta-comic/plugin` 实现暂时保留，待 Kernel/Loader 专项构建、类型检查和测试通过后再迁移后续 Runtime。

## 2026-09-27：6G-1 类型边界确认

- 新 `@delta-comic/plugin-api` 当前只提供 Cordis plugin contract，因此补充中性的 `PluginConfig`、`PluginConfigEnvironment` 和 `PluginConfigFactory`，供 Kernel/Runtime 共享。
- Loader 以 `PluginScopeLike` 结构契约描述激活阶段所需的 `defer` 能力，避免 Loader 反向依赖聚合包；Kernel candidate 使用 Loader 的 `LoadedPluginModule` 类型。
- Kernel candidate 改用 `@delta-comic/plugin-manifest` 的 `PluginManifest`，具体存储、网络和来源 reader 继续留在 Install 阶段。

## 2026-09-27：6G-1 Kernel/Loader 源码核查

- `candidate.ts` 的迁移依赖可压缩为三条公共边界：`@delta-comic/plugin-manifest` 提供 `PluginManifest`，`@delta-comic/plugin-api` 提供中性 `PluginConfigFactory`，`@delta-comic/plugin-loader` 提供 `LoadedPluginModule`。
- `capability.ts` 的激活管线只需要中性插件配置、`PluginScope` 和 `AbortSignal`；`contribution.ts`、`dependency.ts`、`scope.ts` 均可保持来源无关。
- 旧聚合包中的 Kernel 文件继续保留，首阶段新包采用独立源码与测试；完成专项验证后再由 Runtime/Install 迁移调用方，避免提前破坏聚合包构建。

## 2026-09-27：6G-1 Manifest 字段迁移

- 新 Kernel dependency planner 使用 `manifest.id` 与 `manifest.dependencies`，对应新 Manifest 协议；旧 `name.id` 与 `require` 仅属于待迁移聚合实现。
- Kernel/Loader 首阶段保留旧聚合源码，独立包先完成等价行为和新协议字段测试，再切换后续 Runtime/Install 调用方。

## 2026-09-27：6G-1 构建任务拓扑

- Vite+ 的 `run.tasks` 已提供新包的 `build` 与 `typecheck` 任务，package scripts 不能重复声明同名任务；Kernel/Loader 的重复 `build` 与 `typecheck` scripts 已移除。
- Loader 类型检查依赖 `@delta-comic/plugin-api` 的 dist 声明产物，专项验证需先构建 API，再构建或检查下游包；API 的任务图已声明依赖构建。
- Kernel 类型检查发现新包迁移时需显式将 `Map.delete` 包装为 `void` disposer，测试中的 `Array.push` 也需使用块体避免返回 number；两处已按 `PluginDisposer` 契约修正。

## 2026-09-27：6G-2 Runtime 实施边界

- Runtime 独立包迁移 `engine`、`providers`、`store`，依赖收敛到 `@delta-comic/plugin-api`、`@delta-comic/plugin-kernel`、`@delta-comic/plugin-loader`、Vue 和 logger。
- 新 Manifest 使用 `id` 与 `dependencies`；Runtime display name 使用 Manifest 的字符串 `name`。Install、数据库、Tauri、文件存储和市场适配器继续留在聚合包 composition。
- Runtime 的 config、i18n、hooks 通过 API 中性类型表达，保留聚合包后续适配现有宿主配置的边界。
- 根级 `vp test run` 当前只加载既有 workspace 的测试项目，新 Kernel/Loader 测试路径被根配置排除；专项测试应通过各新包的 Vite+ `test` 任务执行。

## 2026-09-27：6G-2 Runtime 完成与聚合接线

- `@delta-comic/plugin-runtime` 已完成 engine、providers、store 迁移；包内 `runtime/test/index.test.ts` 的 4 个测试通过，Runtime build 与 `vp check --fix` 通过。
- 聚合 composition 通过 `runtimeAdapter.ts` 适配现有 Install 的 legacy manifest、module reader 和 capabilities：legacy `name.id`/`version.plugin`/`require` 映射到新 Manifest 的 `id`/`version`/`dependencies`，旧 scope/config 在 adapter 边界转换；Install 内部协议保持原状，后续迁移仍待执行。
- `core.builtin.ts`、builtins 导出和 InstalledPluginCandidateProvider 已切换到新 Kernel/Runtime 契约；聚合包继续负责 concrete assembly，并通过 `@delta-comic/plugin-runtime` 对外导出 Runtime。
- 旧聚合 Runtime engine/providers/store 源码及对应三组测试已删除，新 Runtime 测试作为规范测试；聚合 plugin typecheck、plugin build、选定 capability/install/architecture 测试和全仓 `vp run lib-build` 均通过。聚合 package 没有独立 `test` task，因此使用 `vp test run` 指定既有相关测试文件。
- tsgo-backed Runtime standalone typecheck 仍报告 12 个与当前源码不一致的陈旧 `PluginConfig<DCPluginConfig>`/`DCPluginConfig` 诊断；listFiles、当前源码、dist 声明、symlink 和 tsconfig 均已核对，作为工具链限制记录，不改变正确 Runtime 源码。

## 2026-09-27：6G-3 Install 与 Vite 包边界

- `@delta-comic/plugin-install` 承载安装服务、来源 resolver、ZIP codec、stored/dev module reader、candidate provider、artifact reader 和安装协议；数据库 archive repository、Tauri 文件存储与市场 client 仍由聚合 composition 注入。
- `@delta-comic/plugin-vite` 承载构建和开发服务器适配器，依赖 Install 的 dev 协议常量与通用构建工具，不依赖 Runtime、数据库或应用服务。
- 聚合 `@delta-comic/plugin` 通过新包导出 Install/Vite，删除旧 `lib/install`、`vite` 实现和对应测试，发布工作区与版本同步路径已纳入五个新增公共包。
- Install 专项 24 测试、Vite 专项 26 测试、聚合插件 40 测试、发布工作区 3 测试和 semantic release command 4 测试通过。

## 2026-10-01：6E 目录发布 CAS 边界

- 目录发布器当前执行 load/save；并发发布或撤回会覆盖同一份目录。CAS 以可选版本快照与条件保存接入现有存储协议，目录 JSON 格式保持稳定。
- 已核对 Cloudflare 官方 R2 Workers API 文档：https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ 。`put` 接受 `onlyIf: R2Conditional | Headers`，条件失败返回 null；`httpEtag` 提供符合 HTTP 格式的带引号 ETag，写入具备强一致性。
- R2 创建目录使用 `If-None-Match: *`，更新使用读取对象的 `httpEtag` 作为 `If-Match`。HTTP GET 暴露 ETag，条件 PUT 的陈旧版本返回 412，发布/撤回冲突返回 409；调用方刷新目录后重试。
- Worker 已改为将原始 R2 binding 传入适配器，保留条件写入返回值并能把冲突映射到发布响应。

## 2026-10-01：Runtime 模型类型错误根因

- `PluginStore<TConfig>` 的泛型约束是 `PluginConfig<object>`。方法公开签名可以用 `keyof NonNullable<TConfig['model']>` 推导模型键，内部访问 `config.model` 时编译器使用约束 object，导致 TS2536。
- `new PluginStore()` 默认模型为 object，`keyof object` 为 never；两处 expose 查询测试需指定包含 expose 的模型类型。对象被后续传入 markLoading 时，已创建的 store 的泛型不会随调用改变。
- 公开 modelEntries 重载保留键到值的精确类型，实现接收 PropertyKey 并通过 Reflect.get 读取、标注 unknown、过滤 undefined。宿主模型接口继续保持现有约束。

## 2026-10-01：第 10/11 章实施前核查

- `ARCHITECTURE.md` 第 10 章描述的是目标边界：Tauri 桌面/Android 应用、Worker 服务端、独立 admin、客户端诊断表与服务端平台表、下载器宿主接入和 Android 能力分支；其中示例代码含有伪 API 与不符合当前类型约束的 `any`，不能直接照搬。
- 当前真实应用仍位于 `packages/client/app/app`，已同时包含 `src-tauri`、Vue 页面、插件功能和测试；server 位于 `packages/server/core/server`，admin 位于 `packages/server/admin/panel`。仓库没有 `apps/desktop` 或 `apps/mobile` 目录。
- 第 11 章要求依赖升级、统一发布、版本协议、验证流程和网络插件内化。当前仓库已存在多个 `@delta-comic/*` 公共包及 Vite+ 任务，必须先核对实际 package scripts、锁文件和发布脚本，再决定可落地范围。

## 2026-10-01：阶段 6E Cloudflare 边界验证

- Workers for Platforms 的 `DispatchNamespace.get(name, bindings, options)` 接受每次 dispatch 的绑定和资源限制；`CloudflareDispatchWorkerProvisioner` 将 `PLUGIN_ID`、`INSTALLATION_ID` 和 manifest limits 传入对应 installation worker。
- D1 REST API 创建端点为 `POST /accounts/{account_id}/d1/database`，删除端点为
  `DELETE /accounts/{account_id}/d1/database/{database_id}`。安装记录保存创建响应的 `uuid`，回收时按该 ID 删除。
- R2 Workers API 的条件写入通过 `onlyIf: Headers` 表达，`If-None-Match: *` 用于 artifact 首次上传，条件失败返回 `null`；重复 artifact 由 HTTP handler 转换为 409。
- 管理端 `AdminApiClient` 使用 `{ ok, data }` envelope，诊断快照接口已统一该响应格式，避免页面读取时绕过管理 API 契约。
- 生产发布工作流由 `.github/workflows/server-deploy.yaml` 固化验证、远程迁移、Worker 部署和可选 Pages 部署；WfP、R2 bucket 与 secret 仍由部署环境配置。

- 第 10 章当前采用单一 Tauri 应用共享 desktop/Android 入口；原生下载器已有 Android SAF/UIDT/WorkManager 和 desktop 编译分支，Cloudflare auth_users/auth_sessions 已有 Kysely typed repository 与 0001_auth migration。
- 客户端新增诊断表沿用 TypeBox schema codegen；Rust 迁移通过 include_str 消费生成 SQL。持久化按插件保留 100 条，应用按顺序写入并报告失败。
- 2026-10-01 从 npm/crates 元数据核对依赖：Vue 当前 RC 为 3.6.0-rc.10，Cordis rc.10，Kysely beta.2，tslog 5.2.0，pino 10.3.1；Tauri 3 仍为 alpha，因此保持 Tauri 2.11.x 与 specta 2.0.0-rc.25。

## 第 12 章审计（2026-10-02）
- 实际项目为 `/Users/wenxig/Documents/delta-comic`，初始工作树干净。
- 根架构文档共 12 章，无第 13 章；第 12 章描述阶段 40A 已实现基线。
- 既有阶段 10、11 验收已完成；本轮按现行实现核对第 12 章契约。
- 包路径为 shared/core/both、client/core/sdk、server/core/server。
- 仓库要求先 lib-build，再 check/typecheck/test；任务完成后签名提交。
- 发现 SDK 生命周期缺口：客户端 UI 注册只在整个 runtime.dispose 清理，unmount 未绑定插件 fiber；服务端路由/cron/queue/migration 同样留在全局集合。
- store.get/delete/keys 的真实调用位于诊断边界外，失败无法记录。
- CordisRuntime 的并发 mount 检查在 await 前后存在间隙；待核对上游 Fiber 失败与 context disposal 语义。

### 包边界复核

- Shared 已收敛为 client/server 均有消费者的 `@delta-comic/both`、`@delta-comic/logger` 日志核心和 `@delta-comic/plugin-manifest` 协议；Tauri logger transport/crate 与其它客户端模型、工具、插件 API/runtime/install/Vite/host 已迁移到 client。
- `@delta-comic/plugin-manifest` 由 client SDK 和 server SDK 同时依赖；`@delta-comic/both` 的 Cordis/诊断/runtime 契约由两端 SDK 同时依赖；`@delta-comic/logger` 被 client app、server Worker 和 server admin 使用。

## 2026-10-02：shared 的双端必要性边界

- `packages/shared` 中的包、代码和类型必须同时由 client 与 server 直接消费，并代表两端必须一致的实现或协议；单端调用便利不能作为共享理由。
- release catalog schema、store 与 publisher 目前由服务端目录存储/发布实现消费，客户端市场使用自己的 catalog contract，因此这些文件及测试归入 `packages/server/core/server/lib/catalogProtocol`。
- 客户端 Artifact 校验与 plugin kernel/loader 是安装和宿主实现，归入 `packages/client/core`。共享 Manifest schema 由两端 SDK 消费；Cordis、诊断/runtime 与日志核心由两端运行时消费。
- 重新验收通过：180 个测试文件、954 个测试；lib-build、格式/lint、递归类型检查、codegen schema 检查与 diff 检查通过。Rust fmt/clippy/workspace tests 通过。
