<!-- cspell:ignore Cordis deepseek subrequest specta -->

### 2026-10-03 - HTTP 插件 Specta 过渡适配

- HTTP 插件 Rust 类型和 Tauri 命令改用 `specta::Type`、`#[specta::specta]` 与旧 Specta builder。
- 桌面/移动端 debug 入口导出 HTTP bindings；导出先写临时文件并比较内容，避免 Vite 热重载循环。
- 绑定将 `u64`/`usize` 映射为 TypeScript `number`，前端沿用直接返回值模式；流式 body 的原始二进制 IPC 保留。
- 已移除旧 `ts-rs` 绑定目录，前端请求体适配 Specta 生成的 `number[]`。
- 验证通过：HTTP typecheck、HTTP 9 项测试、Rust fmt、HTTP/desktop/mobile cargo check。

# Delta Comic 架构重构规划进度

## 2026-10-04 — 测试质量审计

- 已确认用户修改的覆盖率阈值位于 `vite.config.ts`，保持不动。
- Luna 扫描约 173 个 TS 测试文件及 Rust/Kotlin 测试；未发现应整文件删除的高置信度套件。
- 删除仅验证存在性的 `PluginManifestSchema`、数据库实例、Web dialect、动态 slot、`DcImage.imageIns` 断言；删除 desktop/mobile App、Router、平台适配中的冗余存在性与 void 返回断言；删除 server admin 路由中仅检查 not-found 组件存在的独立用例。
- 删除存在性断言后，将依赖这些值的可选调用改为非空调用，保持缺失行为在运行时失败；保留协议、边界、失败路径、生命周期和渲染断言。desktop/mobile 的同源测试继续保留，以覆盖独立构建入口。
- `vp run lib-build`、受影响专项测试（80 tests，单独 db 测试 1 test）、`vp check --fix`、`vp run -r typecheck` 和 `git diff --check` 通过。
- 全量 `vp test run`：169 files / 898 tests 通过，4 个文件 / 8 个测试失败；失败位于未修改的 UI Tailwind 类名断言和 release workspace 的 `@delta-comic/http` 发布配置。
- 已签名提交 `cd1d47a2`（测试清理）与 `4c0ed81c`（覆盖率阈值调整），提交后工作树清洁。

## 2026-10-04 — UI 样式实现断言清理

- 用户确认类名断言限制 UI 自由，启动第二轮 Luna 扫描，重点处理 Tailwind 类名和 CSS 实现细节断言。
- 删除 `DcTab`、基础组件、下拉刷新、虚拟瀑布流、配置提供器、Markdown、UI utils 和 admin shared components 中的类名、精确布局 style、主题 CSS 字符串和 Tailwind 合并实现断言；删除 `tailwind-components.test.ts` 样式架构约束套件。
- 保留文本、事件、aria/role、data 属性、状态机、可见项顺序、导航和资源行为断言。UI/admin 专项 55 tests、类型检查和 `vp check --fix` 通过。
- 全量 `vp test run`：171 files / 898 tests 通过，2 个文件 / 5 个测试失败；剩余失败全部来自未修改的 `@delta-comic/http` 发布配置检查。
- 将 `packages/client/platform/http/package.json` 标记为 `private`，明确 HTTP bridge 不参与 npm 发布；release workspace 与 semantic-release 7 项测试全部通过。
- 修复后全量 `vp test run` 通过：172 files / 901 tests；`vp check --fix` 通过且无 lint 警告，`git diff --check` 通过。

## 会话记录

### 2026-10-02 — 收敛文档与生命周期残留

- 核对服务端阶段签名提交 `d23ed6dc`，接续共享生命周期包装器清理。
- 删除 SDK 无调用方的宿主组合工具和 UI scope 入口，UI 子入口导出注册类型。
- 根架构说明按现有 Context/Fiber、manifest v2、单 Worker/共享 D1 和 JSON 流程重写。
- 部署文档同步用户认证、迁移与流程协议；开发进度入口指向当前规划记录。
- Cloudflare 官方约束已现场读取，免费请求 CPU 10 ms、D1 每次调用 50 条查询，资源验收待测量。
- 收敛验证通过：lib-build、check、递归 typecheck、4 个专项文件/19 个用例和 diff 检查。

### 2026-10-02 — 单 Worker JSON 流程阶段完成

- 使用 json-logic-js 解释表达式，流程通过原生 Cordis Fiber 执行；认证身份决定租户，D1 存储安装、配置、定时、执行记录及插件键值。
- codegen 新增四张租户维度表，迁移 0005 建立流程表，0006 清理旧插件表；管理指标使用新流程记录。
- 管理端接入用户令牌、JSON 编辑、启停、间隔任务、手动执行和记录；云客户端迁移到服务端独立 API 子入口。
- 实际本地 D1 验证并发租户和插件键隔离、在线更新、重复定时领取、失败步骤、流式取消释放；修复取消与读取结束的竞争。
- 验证：lib-build、check、递归 typecheck、44 个专项测试文件/201 个用例、codegen:check 和 diff 检查通过。页面测试网络调用已替换并单独复核。


### 2026-09-26 — 规划落盘

- 用户确认 SHA-256 manifest hash 是产物校验方式，本阶段不增加发布者签名。
- 用户说明服务端此前未曾实际部署，平台服务端业务数据不需要旧版数据迁移；未来每安装实例独立 D1 的 schema 生命周期仍需设计。
- 用户确认新增 `@delta-comic/both` 公开包，以承载平台无关/共有能力；Cordis 使用上游发布包，并可由共享包统一 re-export/版本约束。
- 用户要求使用表格一次提出一批问题，避免多轮一次一个问题；禁止 OpenCode ask question/question 工具。
- 用户切换到 build mode 的目的是把规划落盘，未批准开始实现。
- 已新建 `task_plan.md`、`findings.md`、`progress.md`。下一步整理一批高影响的需求问题，通过普通对话一次集中询问，回答后及时更新规划文件。
- 规划快照已通过签名提交 `e6191f0b docs(architecture): 持久化全仓重构规划`。
- 首次提交钩子因 `Cordis`、`deepseek`、`subrequest` 词典未收录而失败；在规划文件加局部 cspell 忽略注释后重试，`vp run codegen:all && vp check --fix && vp run codegen:check` 与 cspell 均通过，签名提交成功。

## 当前状态

- 2026-10-01 Runtime 修复：已定位模型约束和测试默认泛型的三处错误；store 重载与测试显式模型类型的方案通过独立 typecheck，正在验证宿主调用方。
- Runtime 修复验证完成：`vp run lib-build`、`vp check --fix`、`vp run -r typecheck`、Runtime 专项测试（1 file / 5 tests）、`vp run codegen:check` 和 `git diff --check` 均通过。下一步回到 6D StaticPluginExecutor 生命周期迁移。
- 2026-10-01 当前执行：6E 目录发布 CAS，设计已获用户批准。已核对 R2 条件写入官方接口，正在实现版本快照、冲突响应和专项测试。
- 目录 CAS 实现的专项验证已通过：`vp run lib-build`，以及 both/server 的目录存储、发布器、HTTP handler、R2 adapter 测试（5 files / 16 tests）。
- 全量 Web 测试通过：159 files / 865 tests；`vp check --fix`、both/server 类型检查和 `git diff --check` 通过。阶段 6E 目录发布 CAS 完成，下一步转入 6D StaticPluginExecutor 生命周期迁移。
- 当前阶段：阶段 6G Install/Vite 迁移已完成；阶段 6D/6E 的完整旧宿主迁移、市场发布身份/CAS、WfP provisioning、应用/admin 重组和完整部署流水线仍在待办清单。
- 代码实现：both 公共 Manifest、artifact 校验、诊断记录器和 Cordis runtime harness 已完成并通过专项验证。
- 设计 spec：已由根目录 ARCHITECTURE.md 与 findings.md 承载并获用户批准。
- 下一个动作：继续实现 6D/6E 的完整旧宿主迁移、市场发布身份/CAS、WfP provisioning、应用/admin 重组和完整部署流水线。

### 2026-10-01 — 阶段 6D StaticPluginExecutor 生命周期迁移

- `StaticPluginExecutor` 新增可注入 `StaticPluginRuntimeFactory`；生产插件服务通过 `createAppServerRuntime` 为静态插件创建 `ServerRuntime`。
- 静态定义的 `start` 在 Cordis fiber mount 中执行，`stop` 注册为 fiber effect disposer；executor stop 通过 `ServerRuntime.unmount` 触发清理。
- 保留无 runtime factory 的旧调用路径，安装、更新、卸载、健康检查协议保持不变。
- 验证通过：server executor/service/runtime 专项测试（3 files / 21 tests）、server typecheck、`vp check --fix`、`git diff --check`。
- 阶段 6D 剩余诊断面板、事件回放执行器和客户端旧 runtime 全量迁移继续排队；随后处理阶段 6E 发布身份、CAS 工作流与 WfP provisioning。

### 2026-09-27 — 阶段 6G Install 与 Vite Adapter

- 新增 `@delta-comic/plugin-install`，迁移 Install contracts、service、source resolver、ZIP codec、stored/dev module reader、candidate provider、artifact reader 和 marketplace ports。
- 新增 `@delta-comic/plugin-vite`，迁移构建与开发适配器，保留原生 Vite HMR、CSS bridge、Vue SFC style 聚合、CORS/no-store endpoint 和 ZIP 产物行为。
- 聚合 `@delta-comic/plugin` 的 composition 改用新 Install/Vite 包；数据库 archive repository 保留在聚合 adapters，旧 `lib/install` 与 `vite` 源码及测试已移除。
- 发布工作区和版本同步清单纳入 `plugin-loader`、`plugin-kernel`、`plugin-install`、`plugin-runtime`、`plugin-vite`，并为新公共包补齐 `publishConfig.access`。
- 验证通过：Install build/typecheck/24 tests，Vite build/typecheck/26 tests，plugin aggregate 13 files/40 tests，release workspace 3 tests，semantic release command 4 tests，`git diff --check`。
- 阶段 6D/6E 的完整旧宿主迁移、发布身份/CAS、WfP provisioning、应用/admin 重组和完整部署流水线仍未完成。

### 2026-09-26 — 阶段 6A Artifact Loader 接入

- 新增 `CordisArtifactModuleReader`，使用共享 `@delta-comic/both/artifact` 校验 Manifest、资源依赖图、路径和 SHA-256 完整性。
- 复用现有 `PluginFileStore` 的 Blob URL + dynamic import 和资源释放边界，保留旧配置工厂 Loader 的独立行为。
- 对 `plugin` 与 `plugin-set` 入口执行运行时形状校验，并覆盖提交、释放、错误和入口类型测试。
- `@delta-comic/plugin` 接入 `@delta-comic/both` 依赖；插件 typecheck 与 module reader 测试（6/6）通过。

### 2026-09-26 — 阶段 6B Server SDK 发布构建

- 将 `@delta-comic/server` 设为公开版本包，exports 指向 dist，并公开 Worker app、Manifest 和 runtime 子路径。
- 分离 pack 产物目录：SDK 输出到 `dist/lib`，Worker bundle 输出到 `dist/app`，防止 SDK 清理/打包覆盖部署产物。
- 将 server package纳入版本同步，并更新 release workspace 的公开包清单测试。
- `vp -C packages/server/core/server pack` 成功生成 SDK 与 Worker ESM/声明文件；server typecheck、SDK/release专项测试（4/4）及 `vp check --fix` 通过。
- Worker pack 检查提示 `cloudflare:workers` 为平台提供的 external import；正式 Worker 部署仍由 Cloudflare Vite plugin 构建。
- `vp check`、递归 typecheck、server/release 专项测试和 lib-build 均通过，6B 已具备提交条件。

### 2026-09-26 — 阶段 6C Tauri Specta 类型生成

- 为 Tauri 应用接入旧 Specta bridge 依赖，新增 `get_runtime_platform` typed command。
- 使用旧命令收集宏与 `#[specta::specta]`，debug 构建和 Rust 单元测试都会生成旧 bindings。
- 将生成绑定纳入 app 源码，后续宿主迁移可直接通过 `commands.getRuntimePlatform()` 调用。
- `cargo check -p delta-comic --locked`、`cargo fmt --all --check` 和绑定导出单元测试通过。

### 2026-09-26 — 阶段 6D 下载器与 UI 宿主接入

- 客户端 SDK 新增 `ClientDownloader`，复用现有 Downloader 的任务、设置、下载、凭证和事件 API，并在命令边界统一写入诊断记录。
- ClientRuntime 为每个插件提供独立 downloader key；外部注入的 downloader 由调用方管理，SDK 自建实例随 runtime dispose 释放。
- ClientUi 接入 `@delta-comic/ui` 的 EnvironmentRegistry，以插件 ID 作为 owner；显式 disposer 和 runtime dispose 都会清理环境注册。
- UI 新增 `./environment` 公共出口，library build 生成独立 environment 入口并保持既有 `./style.css` 对应 `dist/index.css`。
- 客户端 SDK 新增 `./ui` 出口和 UI 生命周期测试；客户端专项测试 4/4、UI/client typecheck 与 `vp check --fix` 通过。
- routes、导航项和 command 的真实宿主注册仍待迁移；诊断 harness、网络宿主、服务端宿主迁移和阶段 6E 保持未完成。

### 2026-09-26 — 阶段 6D 诊断 harness 与客户端网络宿主

- `@delta-comic/both` 新增 `DiagnosticHarness`，支持快照归档、JSON 导入/导出和按记录顺序 replay；保留诊断记录容量边界，并校验导入归档版本与基本结构。
- `@delta-comic/client` 新增可注入 `ClientNetworkTransport` 的网络服务，默认使用宿主 `fetch`，GET/POST/request 统一经过 `withDiagnostic`，插件可替换 transport 以适配 Tauri 或测试环境。
- ClientHost/ClientRuntime 注入网络服务，新增 `./network` 公开出口；专项测试覆盖网络 transport 和请求诊断。
- both/client 专项验证共 11 个测试通过，typecheck 与 `vp check --fix` 通过。
- 真实诊断面板、事件总线快照、事件回放执行器、UI 路由/导航/命令宿主和服务端业务迁移仍保持未完成。

### 2026-09-26 — 阶段 6D UI 宿主 registrar 接口

- `ClientUi` 新增 route/navItem/command registrar adapter contract，`ClientRuntimeOptions.uiRegistrars` 可由宿主注入真实实现。
- `createClientUi` 将插件注册委托给宿主 registrar，并统一保留 disposer；runtime dispose 会撤销全部外部注册。
- 测试覆盖三个注册类别以及 dispose 清理顺序；client typecheck、专项测试（6/6）和 `vp check --fix` 通过。
- app 的 Vue Router/导航/command 具体 adapter 尚未接线；此接口阶段不计作 app UI 迁移完成。

### 2026-09-26 — 阶段 6D app UI 宿主接线

- app 新增 `clientHost`，将 ClientRuntime 的 route、navigation 和 command registrar 接入 Vue Router、响应式导航注册表和宿主 command registry。
- 插件路由统一归档到 `/plugins/{pluginId}/...`，并通过 owner 生成稳定 route name；插件导航项随 runtime disposer 清理。
- 主导航根据当前 pathname 高亮插件页面；command ID 冲突会显式报错，避免覆盖其他插件注册。
- app/client typecheck、路由与 Client SDK 专项测试、`vp check --fix` 通过。
- 真实 command palette 视图、旧 plugin runtime 全量迁移和服务端业务迁移仍未完成。

### 2026-09-26 — 阶段 6D 服务端 Worker 诊断适配器

- 新增 `ServerWorkerAdapter`，在现有 Elysia/Cloudflare Worker fetch 与 scheduled 边界统一记录成功、失败和耗时诊断。
- Worker 入口继续保留现有模块组合、运行时绑定和 scheduled plugin script runner；适配器仅负责生命周期观测与可注入 `DiagnosticRecorder`。
- 增加 fetch/scheduled 适配器测试，并从公开 `@delta-comic/server` SDK 导出适配器。
- 服务端旧业务到 `ServerHost` 的迁移、WfP 动态 dispatcher、D1 per-installation 与阶段 6E 仍未完成。

### 2026-09-26 — 阶段 6D D1 ServerRuntime bridge

- 新增 app 内部 `createAppServerRuntime` 工厂，使用现有 `createKysely` 和 `D1ServerPluginHost` 构造带 typed DB、诊断和 legacy host bridge 的新 `ServerRuntime`。
- 保留现有 `StaticPluginExecutor`、Elysia 路由组合和插件控制面；本阶段提供真实切换入口，不宣称旧工厂插件已完成 Cordis 迁移。
- 增加 runtime factory 测试；服务端 typecheck、专项测试和 lint 通过后提交。
- WfP 动态 dispatcher、D1 per-installation migration、市场发布、诊断面板和 app/admin 重组仍未完成。

### 2026-09-26 — 阶段 6E Artifact migration 执行边界

- `ServerRuntime.migrateArtifact` 接收 server artifact manifest，核对 Manifest 声明的 migration ID 与 Cordis/ServerHost 已注册的 typed migration。
- 核对通过后按注册顺序执行 migration，并复用现有诊断记录；声明缺失或多余 migration 时明确失败。
- SQL 文件解析、artifact 资源加载、D1 per-installation/schema 生命周期和 Worker dispatcher 仍未完成。

### 2026-09-27 — 阶段 6E Worker dispatcher 边界

- 新增 `ServerWorkerDispatcher`，由宿主解析请求对应的 `ServerRuntime`，再将 fetch 请求交给 runtime 的 typed route dispatch。
- scheduled 事件根据 cron 表达式筛选已解析的 installation runtimes，并复用 `ServerRuntime.runCron`；dispatcher 自身记录 fetch/scheduled 诊断。
- 该边界保留现有 Elysia/旧插件控制面，不创建虚假的 D1 隔离；SQL artifact 加载、D1 per-installation 生命周期、市场发布、应用/admin 重组和部署文档仍未完成。
- server typecheck、dispatcher/SDK 专项测试（2 个文件、4 个测试）和 `vp check --fix` 通过。

### 2026-09-27 — 阶段 6E SQL artifact migration runner

- Server Manifest 新增可选 `migrationResources`，把 migration ID 映射到 artifact 内的 SQL 文件路径。
- 新增 `applyServerSqlMigrations` 与 `ServerRuntime.migrateSqlArtifact`，按 `pluginId + installationId + migrationId` 建立 D1 记录，重复执行会跳过已应用 migration。
- runner 校验声明与资源一一对应、校验 SQL 文件存在，并在执行 SQL 后写入应用时间；测试覆盖首次应用、幂等重跑和声明不完整错误。
- server typecheck、dispatcher/SDK/migration 专项测试（3 个文件、6 个测试）和 `vp check --fix` 通过。
- SQL runner 已形成 D1 生命周期边界；正式 artifact 存储下载、WfP runtime provisioning、市场发布、应用/admin 重组与部署文档仍未完成。

### 2026-09-26 — 40 项架构决策确认

- 用户批量确认了 40 项架构设计决策，涵盖包与协议 (1–6)、模块与构建 (7–12)、客户端 API (13–18)、服务端 (19–26)、安装/诊断 (27–35)、应用/文案/发布 (36–40)。
- 关键决策包括：
  - @delta-comic/both 统一 Cordis re-export 及版本约束；client/server 各自独立 Manifest。
  - 保留现有 Blob URL + dynamic import 模块加载方案，暂不强制虚拟模块 (9C)。
  - 客户端插件通过 typed API 全量访问数据库/store，每次调用接入诊断链 (15A)。
  - 服务端插件导出 Cordis plugin/set，Worker runtime 注入服务 (8A)；artifact 携带 SQL migration，Worker 切换前执行 (22A)。
  - 放弃多语言，全部文案硬编码，不区分外部/内置插件 (37)。
  - 先完成 SDK/runtime/示例/校验/诊断，再迁移完整能力 (40A)。
- 已将 40 项决策追加到 `findings.md`，更新 `task_plan.md` 阶段 2 状态为 complete，并更新 Next Step。
### 2026-09-26 — 模块加载细节补充确认 (9-12)

- 用户补充确认了第 9-12 项模块加载机制决策：
  - 9C: 保留现有 Blob URL + dynamic import，不引入虚拟模块解析。
  - 10 (修改版 D): 平台 SDK/Cordis/UI 库由插件构建时 externalize，运行时宿主注册为全局模块；其他依赖插件自行打包。
  - 11A: Manifest 完整声明资源依赖图 (path/mimeType/integrity/imports/platform)。
  - 12A: 内置/外部插件统一 SDK/Manifest/Loader 合约；内置源码参与宿主构建，外部产出 artifact。
- 用户明确宿主提供 SDK 的方式为"构建时 externalize + 运行时宿主注册全局模块"。
- 新增未决问题：宿主全局模块注册的具体 API 形态 (window 直接挂载 vs 模块加载器)。
- 已更新 `findings.md` 补充决策章节和剩余未决问题。
- 下一步：提交本次更新，继续方案 A 的详细设计。

### 2026-09-26 — 类型系统与 Cordis-first Loader 策略

- 用户确认 **specta 是整个架构的类型基础设施**，单一类型源派生多端类型。
- 用户澄清 **插件间依赖应通过 Cordis Context 与 TS 模块扩展定义类型**，而不是直接依赖其他插件实现；Service 暴露能力，`inject` 声明依赖，TypeScript Module Augmentation 扩展 Context 接口。
- 用户要求 **Loader 和模块依赖处理更多基于 Cordis**：Delta Comic Loader 只负责读取 artifact 与解析 Manifest，依赖解析/激活顺序/循环检测/卸载由 Cordis 自动处理；Manifest dependencies 用于安装时校验，运行时由 Cordis inject 决定。
- 已更新 `findings.md` 补充 Cordis-first Loader 与依赖策略。
- 设计进度：第 1-3 章已获批准；第 4 章（Cordis/Loader/Manifest）已按 Cordis-first 原则重写，等待展示完整版并获批准后继续第 5 章。

### 2026-09-26 — 阶段 40A 公共协议实现

- 扩展 `@delta-comic/both` Manifest：协议版本、依赖、资源完整性、导入图、平台和入口类型。
- 新增 artifact 校验：规范化相对路径、验证资源声明、导入图、重复文件、缺失文件和 SHA-256 integrity。
- 新增有容量上限的 `DiagnosticRecorder`、诊断快照和 `CordisRuntime` mount/unmount/dispose harness。
- 修复 Web-only TypeScript 兼容性：移除 Node Buffer 依赖，适配当前 TypeBox 错误集合 API 和 Web Crypto 类型。
- `vp run --filter @delta-comic/both typecheck`、专项测试（4/4）和 `git diff --check` 通过。

### 2026-09-26 — 阶段 40A client/server SDK 与装饰器

- 新增 `@delta-comic/client`：ClientRuntime、typed database/store/UI host、Cordis injection、客户端 Manifest 和边界诊断。
- 扩展 `@delta-comic/server`：ServerRuntime、typed route/cron/queue/migration host、身份检查、dispatch 和 migration 诊断。
- 将 `@diagnostic` 应用于 runtime 生命周期、路由和任务边界；业务方法继续使用声明式横切追踪，闭包边界使用 `withDiagnostic`。
- both/client/server 的 Vite 测试与 pack 配置均接入 `@swc/core` TypeScript decorator transform，恢复真实 decorator 语法测试。
- 专项验证：3 个测试文件、8 个测试通过；both/client/server typecheck 通过；both/client/server build 通过。
- ARCHITECTURE.md 新增第 12 章实现基线、API 示例、权限/隔离边界和 40A 验证矩阵，并标明早期伪 API 的历史性质。

## 验证

- 本次仅创建规划文档，未运行应用检查/测试。
- 创建前确认仓库工作区干净，仓库根目录不存在 `task_plan.md`、`findings.md`、`progress.md` 或 `.planning` 规划文件。
- 提交前 hook 自动验证 codegen、`vp check --fix`、codegen check 与 cspell 全部通过。

## 2026-10-01：6G 过渡 Kernel 清理

- 审阅阶段 6G 实现后，确认聚合包仍有一套与 `@delta-comic/plugin-kernel` 重复的本地 candidate/capability/dependency/scope，以及 `runtimeAdapter` 转换层。
- 插件能力、聚合入口和运行时已直接使用新 Kernel；保留插件专属的多 channel `ContributionHub`，它承载宿主模型贡献类型，不再复制通用 Kernel 协议。
- 删除旧 Kernel 实现、对应重复测试和 capability adapter；更新 capability state 进度事件映射，并移除旧的报告字段。
- `vp run lib-build`、`vp check --fix`、插件 architecture/capability 专项测试（4 个文件、15 个测试）、`@delta-comic/plugin` typecheck 与 `@delta-comic/plugin-kernel` typecheck 通过。
- 工作树中的 `AGENTS.md` 为用户提供的修改，继续保留且不纳入提交。
## 2026-09-27：6E Artifact 发布元数据边界

- `@delta-comic/both/release` 增加 HTTPS 发布 artifact、版本、目录条目的 TypeBox 协议、解析器和非撤回版本查找函数。
- 协议覆盖平台、下载 URL、Manifest URL、大小、SHA-256 完整性、发布时间和撤回标记；没有引入签名凭证或远程存储实现。
- 下一步实现目录索引的读取/存储适配器，并继续保留市场服务、应用/admin 重组和部署文档为未完成事项。

## 2026-09-27：6E Artifact 目录存储适配器

- `@delta-comic/both/releaseStore` 增加目录索引的内存存储与注入 fetch 的 HTTPS JSON 读写适配器。
- 适配器负责 HTTP 状态处理和 TypeBox 协议解析；认证、签名、R2/D1 持久化与发布工作流仍未实现。

## 2026-09-27：6E R2 目录索引适配器

- `@delta-comic/server` 增加 `createR2PluginCatalogStore`，使用 R2 object `get/put` 读写 JSON 目录索引并复用共享 TypeBox 校验。
- 适配器已通过无对象、读写和 content-type 测试；Worker binding、认证发布接口、版本原子更新和管理后台仍未接入。

## 2026-09-27：6E 市场目录 HTTP handler 与 Worker 接线

- 新增 `createPluginCatalogHandler`，公开读取目录，PUT 写入通过宿主注入的授权回调校验，并统一处理路径、方法和目录协议错误。
- Worker 可选使用 `PLUGIN_CATALOG` R2 binding，在 `/plugins/catalog/index.json` 提供目录读写；写入使用 `SERVER_ADMIN_TOKEN` Bearer token 的常量时间比较。
- 测试覆盖 handler 状态边界和 Worker R2 binding 接线；完整市场发布工作流、发布者身份管理、版本原子更新、app/admin 重组和部署文档仍未完成。

## 2026-09-27：6E 市场发布器领域边界

- `@delta-comic/both/release-publisher` 新增 `createPluginReleasePublisher`，通过共享 `PluginCatalogStore` 发布新版本和撤回已发布版本。
- 发布器校验 HTTPS 发布元数据、插件条目归属、重复版本和撤回目标，并以一次目录保存写回每次领域更新。
- 并发 CAS、发布者身份、签名凭证、artifact 上传、完整市场工作流、应用/admin 重组和部署文档仍未完成。

## 2026-09-27：6E 受授权市场发布端点

- 新增 `createPluginCatalogPublishHandler`，提供发布版本和撤回版本的 POST 端点，复用共享发布器与目录存储。
- 发布端点校验 release/metadata/yank payload，并通过宿主授权回调保护；Worker 入口可以复用 `SERVER_ADMIN_TOKEN` 和可选 R2 catalog binding。
- artifact 上传、发布者账户、并发 CAS、签名凭证、完整市场管理后台、应用/admin 重组和部署文档仍未完成。

## 2026-09-27：6E 市场目录 HTTP handler 边界

- `@delta-comic/server` 增加 `createPluginCatalogHandler`，公开 GET 目录读取，PUT 写入通过宿主注入的授权回调保护。
- handler 校验请求路径、HTTP 方法和完整目录协议，返回明确的 404、405、401 与 400 响应，并复用任意 `PluginCatalogStore`。
- 测试覆盖公开读取、授权写入、非法目录和无关路径；真实 Worker 路由组合、发布身份系统、R2 binding 配置、发布工作流、应用/admin 重组和部署文档仍未完成。

## 2026-09-27：6E 市场目录部署边界

- 新增 `docs/plugin-marketplace-deployment.md`，记录 R2 bucket 创建、`PLUGIN_CATALOG` binding、`SERVER_ADMIN_TOKEN` secret、Worker 部署和发布端点检查命令。
- `packages/server/core/server/wrangler.jsonc` 增加可选 R2 binding 示例注释；未配置 binding 时，目录路由继续保持关闭。
- 文档明确当前目录通过 R2 `catalog/index.json` 保存，发布器使用一次 load/save；CAS、发布者身份、artifact 上传、WfP provisioning、D1 per-installation 自动创建、app/admin 管理界面和完整 CI/CD 仍未完成。

## 2026-09-27：免费账号 Worker 部署边界

- Wrangler 生产配置移除 `worker_loaders`，部署使用 Vite 生成的 `dist/delta_comic_server/wrangler.json`，保留 alias 在 Vite 构建阶段解析。
- 动态旧插件脚本在缺少 Workers for Platforms loader 时使用明确的 unavailable loader 并记录失败结果；目录、发布、SQL migration、静态 Cordis runtime 和现有 API 继续可用。
- 已创建免费 D1 `delta-comic-server-db`，远程应用现有四组迁移，并将真实 database ID 写入 Wrangler 配置。
- 使用 Vite 生成配置完成真实 Worker 部署，地址为 `https://delta-comic-server.wenxig.workers.dev`。`/api/health/live` 返回 200；未配置 R2 binding 时，目录读取和发布路径按预期返回 404，目录功能保持关闭。
- 免费账号采用单 Worker 静态宿主降级；Workers for Platforms 动态脚本、per-installation 自动隔离和配额能力保持未完成。

## 2026-09-27：workspace 目录稳定化

- workspace 收敛为唯一 `packages/*/*/*` pattern，移除旧一级 package 路径和 `apps/*` workspace 入口。
- 13 个现有包已按 client、server、shared 能力域完成三级路径落位，pnpm lockfile workspace links、包内 symlink、TypeScript/Vite/Cargo/测试与发布脚本引用已同步。
- 修复迁移后的全局 API 初始化和 AppNavigation 测试隔离；runtime UMD 产物生成于 `packages/client/app/app/public/runtime/host-libraries.umd.js`。
- 验证通过：`vp install`、`vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run`（171 files / 934 tests）、`vp run codegen:check`、`git diff --check`。
- 当前阶段完成目录稳定化，Cordis 极细粒度包拆分进入下一阶段；市场管理界面保持暂停。

## 2026-09-27：阶段 6G 第一批协议包拆分

- 新增公开包 `@delta-comic/plugin-manifest`、`@delta-comic/plugin-artifact` 和 `@delta-comic/plugin-api`，分别承载 Manifest 协议、artifact 校验和 platform-neutral plugin contract。
- client/server SDK 与现有 artifact reader 已切换到新包；`@delta-comic/both` 移除 Manifest 与 artifact 实现及对应导出，旧导入路径全量清理。
- 新包专项测试、`vp run lib-build`、`vp check --fix`、递归 typecheck 已通过；发布 workspace 测试同步覆盖新增公开包和构建顺序。
- loader、install、runtime、Vite adapter、聚合包后续迁移及市场管理界面仍保持未完成/暂停。

## 2026-09-27：阶段 6G 拆包设计

- 完成并自审 `docs/superpowers/specs/2026-09-27-plugin-6g-package-split-design.md`，明确 Kernel、Loader、Runtime、Install、Vite Adapter 与聚合包的职责、依赖方向、迁移顺序和验收矩阵。
- 设计已通过签名提交 `5980936f docs(plugin): 记录6G拆包设计`；用户授权继续实施，无需再次审批设计决策。
- 下一步进入实施计划阶段，先迁移 source-agnostic Kernel 与 Loader contracts，再逐步迁移 Runtime、Install、Vite 和聚合包。

## 2026-09-27：6G-1 Kernel/Loader 开始

- 进入 Kernel/Loader 第一阶段，计划下沉 Kernel 的 candidate、capability、contribution、dependency、scope 与 Loader 的模块加载契约。
- Kernel 将使用新 Manifest 与中性配置类型，Loader 仅承载 `LoadedPluginModule`、`PluginModuleReader` 等契约；具体来源 reader 继续由 Install/composition 负责。
- 首次专项验证发现 Vite+ `run.tasks` 与 package scripts 同名会阻止任务图加载，已移除 Kernel/Loader 的重复 `build`、`typecheck` scripts；两包 build 已通过。
- Loader typecheck 暴露 API dist 声明尚未生成的顺序问题，后续按 API → Loader → Kernel 顺序执行专项验证。
- API 构建完成；Kernel 类型检查发现并修复 `Map.delete` 与测试 `Array.push` 的 disposer 返回值类型问题。
- Kernel/Loader build 与 typecheck 已通过；根级测试入口未发现新包测试，后续改用各新包的 Vite+ test 任务验证。

## 2026-09-27：6G-2 Runtime 开始

- 6G-1 Kernel/Loader 已完成专项构建、类型检查和包内测试，实施计划进入 Runtime 阶段。
- Runtime 将迁移生命周期引擎、候选 provider 与响应式 store，改用新 Manifest 的 `id`/`dependencies` 字段，并保持 preload、normal activation、reload、enable、disable、uninstall 和 recovery 行为。

## 2026-09-27：6G-2 Runtime 完成

- 完成 `@delta-comic/plugin-runtime` 的 engine/providers/store 拆分，新增 4 个 Runtime 行为测试；Runtime test、build 和检查均通过。
- 完成聚合 composition 接线：新增 legacy Install reader/manifest/capability adapter，内置插件改用新 Kernel 定义，聚合入口导出新 Runtime；`vp run --filter '@delta-comic/plugin' typecheck`、plugin build 和 `vp run lib-build` 通过。
- 删除旧聚合 Runtime 实现及 engine/providers/store 测试；聚合包没有独立 test task，使用指定 capability/install/architecture 测试验证，3 files / 15 tests 通过。
- Runtime standalone typecheck 的 12 个 tsgo 陈旧诊断已记录为工具链限制；当前 Runtime 源码和依赖解析路径已核对。
- 当前进度停止在 Runtime；6G-3 Install、6G-4 Vite Adapter 与完整聚合收敛保持 pending。

## 2026-10-01：阶段 6D/6E 收尾

- 完成诊断快照管理端页面、统一管理 API envelope 和诊断回放响应；服务端测试覆盖授权快照与 Worker 路由。
- 完成发布者身份响应 header、R2 artifact `If-None-Match: *` 条件上传及重复版本 409；SHA-256 integrity 继续作为完整性契约。
- 完成 `CloudflareDispatchWorkerProvisioner`、`CloudflareD1InstallationDatabase` 和 `PluginInstallationManager`。D1 删除使用创建返回的 database ID，安装实例按 plugin/installation 幂等创建并支持回收。
- 新增 `.github/workflows/server-deploy.yaml`，按构建、检查、类型、测试、codegen、迁移、Worker 和 Pages 顺序执行部署。
- 通过 `vp run lib-build`、`vp check`、server/admin typecheck，以及新增服务端专项测试（7 files / 18 tests）；实现已签名提交 `37d0e373`。
- 最终验收通过：`vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run`（164 files / 878 tests）、`vp run codegen:check` 和 `git diff --check`。
- 阶段 6 全部子阶段已完成，最终工作树干净；阶段记录提交为 `e2bf7da5`，页面条件修复提交为 `52c2d97c`。

## 2026-10-01：阶段 7 启动

- 阶段 6 已完成，现按 ARCHITECTURE.md 第 7 章推进 Manifest、Artifact、安装/升级与模块解析。
- 已确认当前仓库的 `@delta-comic/plugin-manifest` 与 `@delta-comic/plugin-artifact` 是现行协议基线，`@delta-comic/plugin-install` 和数据库仍保留旧 Manifest 适配边界。
- 阶段 7 先收敛协议和资源图校验，再补安装兼容性、升级事务和动态 chunk 模块解析；所有结果写入本规划文件并在最终阶段签名提交。

## 2026-10-01：阶段 7 实现完成

- `@delta-comic/plugin-artifact` 增加按目标平台筛选资源的校验选项；入口、资源 imports、重复路径、完整性和路径安全仍在动态加载前统一校验。
- `@delta-comic/plugin-install` 增加 `ArtifactZipPackageCodec`、Artifact Manifest 兼容性与依赖校验、安装阶段 `afterStage` 事务钩子，以及 Blob 资源图模块 URL 解析。
- 资源图为相对静态/动态 import 建立 URL 映射，生成的临时和最终 URL 在 dispose/失败路径统一回收；Node runner 不支持直接 import blob URL，专项测试验证了转换内容。
- 聚合插件更新入口在新文件和数据库元数据阶段提交前执行 runtime reload，激活失败时由安装服务恢复旧版本并由宿主尝试重载旧候选。
- 阶段专项测试已通过：artifact 3 tests、install 4 files/22 tests、manifest 2 tests；`vp check --fix` 通过。
- 验收中 `vp run lib-build`、`vp check` 和递归 typecheck 通过；全量 `vp test run` 为 161 files / 875 passed / 3 existing timeout failures，单独运行失败文件后 db 6 tests 与 plugin 4 tests 全部通过，未发现阶段 7 回归。
- `vp run codegen:check` 与 `git diff --check` 通过；规划状态切换为 complete，阶段实现已签名提交。
## 2026-10-01 阶段 8/9 启动

- 读取并核对 `ARCHITECTURE.md` 第 8、9 章与现有 both/client/server 实现。
- 确认当前已有诊断记录、快照基础、回放 handler、Worker limits 和共享 logger；待补齐作用域安全调用、隐私脱敏、资源限制 schema、丰富 snapshot、事件 recorder/replay、minimal harness。
- 下一步：先修改公共诊断协议与 PluginScope，再接入客户端/服务端适配和专项测试。

## 阶段 8/9 实现进展 1

- 已扩展 `@delta-comic/both`：稳定实体字段、结构化诊断 logger、敏感字段默认脱敏、丰富 snapshot schema、`EventRecorder` 和 minimal runtime harness。
- 已扩展 `PluginScope.safeCall()` 与失败/释放状态；客户端 SDK 暴露 logger、事件录制和 `mountSafely()`。
- 服务端 runtime 绑定 plugin/installation 诊断身份，路由 handler 异常返回 500 并记录；Worker provisioner 增加 memory limit，默认配额调整为 CPU 50、内存 128、subrequest 10；增加身份 header 解析边界。
- `vp run lib-build` 已通过；仍需执行类型检查、专项测试并修复发现的问题。

## 阶段 8 完成与阶段 9 收敛

- 作用域安全调用、身份解析、路由异常隔离、Worker CPU/内存/subrequest 配额和诊断脱敏已完成。
- 结构化 logger、稳定 ID、rich snapshot、EventRecorder.call/replay、minimal runtime、client/server diagnostics facade 已完成。
- `vp check --fix`、递归 typecheck、全量测试（164 files / 881 tests）及新增专项测试均通过。
- 待办：最终重新运行 lib-build、全量 typecheck/test、codegen/diff 检查，完成阶段 9 提交。

## 阶段 9 完成

- 提交后 `vp run lib-build` 通过；`vp check` 通过（854 files），递归 typecheck 通过。
- `vp run codegen:check`、`git diff --check` 通过；全量 `vp test run` 通过（164 files / 883 tests）。
- 签名提交：`74a2c0cd`（功能实现）与 `8dccbcdb`（格式修正）。
- 阶段 8、9 已完成，工作树保持干净。

## 2026-10-01：管理面板命名与网络测试收尾

- 管理面板包由 `@delta-comic/server-admin` 更名为 `@delta-comic/admin`，源码目录由 `packages/server/admin/server-admin` 调整为 `packages/server/admin/panel`。
- 同步 Vite+ workspace、部署 workflow、Pages 项目名 `delta-comic-admin`、日志 scope、审计 actor、浏览器存储键、服务端文档与架构引用。
- 管理面板测试地址统一使用可解析的 `https://example.com`；运行指标页面注入离线 API 响应，测试退出时无悬挂网络请求。
- `vp check --fix`、`vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp run codegen:check` 通过；管理面板定向测试 3 files / 42 tests 通过，页面测试无 AbortError 输出。
- 全量测试最终通过 164 files / 883 tests；输出无 DNS 错误与 AbortError，重命名变更已完成验收。

## 2026-10-01：阶段 10 实施

- 增加 desktop/Android host profile 和 specta runtime platform 接线，新增 profile 专项测试。
- 添加 plugin_diagnostic_log schema、生成 SQL/类型、native/Web 迁移、typed repository、DiagnosticRecorder sink 与应用写入接线。
- 服务端继续使用现有 auth、sync、server plugin D1 migrations 与 Kysely 类型；下载器和 network transport 的平台边界已记录在架构基线。
- `vp fmt --check`、`vp lint`、`vp run lib-build`、`vp check`、递归 typecheck、全量测试（165 files / 886 tests）、codegen check、Rust fmt/clippy/test 和 diff check 全部通过。

## 2026-10-01：阶段 11 验收

- workspace catalog 更新至已核对的 Vue `3.6.0-rc.10`、Kysely `0.30.0-beta.2`、tslog `5.2.0`、pino `10.3.1`，`vp install` 成功并更新锁文件。
- 发布协同基于 `script/release-workspace.mts`、`script/set-version.mts` 与 `release:dry-run` 工作流，架构文档已与真实入口同步。
- 第 10、11 章实现与验收完成，待签名提交保存进度。

## 2026-10-02：第 12 章启动
- 读取技能、仓库规划与 AGENTS.md，完成 session catchup（无待恢复输出）。
- 确认第 12 章范围与缺少第 13 章，添加三阶段实施验收计划。
- 开始核对 SDK、诊断装饰器、资源校验及生命周期契约。

## 第 12 章审计完成
- both runtime、diagnostic、artifact 与 manifest 契约已核对。
- 确认实现缺口：mount 失败元数据清理、客户端 UI/服务端扩展注册的插件生命周期、store 读删键诊断、client diagnostics 子路径构建入口。
- 进入实现阶段，采用现有 Cordis mount/unmount 边界和最小作用域注册追踪。

## 第 12 章实现修复
- CordisRuntime mount 失败时清理插件元数据。
- Client UI registrations 按插件作用域追踪，client unmount 释放对应 route/nav/command/environment；store read/delete/keys 纳入诊断。
- Server route/cron/queue/migration registrations 按插件追踪，server unmount/dispose 释放注册项。
- client SDK pack 增加 diagnostics 子路径产物。
- 新增 client/server 作用域与 store 回归测试；both/client/server 专项测试通过。
- 按 shared 硬边界迁移客户端专属的 plugin API/artifact/kernel/loader/runtime/install/Vite/host、model、utils 到 `packages/client`；Tauri logger adapter 与 Rust crate 归入 client，shared logger 保留跨端核心。

## 2026-10-02：shared 双端消费边界与第 12 章验收完成

- 将 release catalog schema、HTTP/memory store、publisher 和相应测试迁入 `packages/server/core/server`；服务端 catalog upload 与测试改为依赖 server 本地协议。
- 修正 `ARCHITECTURE.md` 中 shared 对 Artifact 的旧归属描述，并为每个 shared 包列出 client/server 消费者；确认 `shared/core/both` 不再包含 release catalog 能力。
- 第 12 章生命周期清理、store 操作诊断和 diagnostics 子路径产物已有回归测试；规划记录更新为 complete。架构文档无第 13 章。
- 验证通过：`vp run lib-build`、`vp check --fix`、`vp run -r typecheck`、`vp test run`（180 files / 954 tests）、`vp run codegen:check`、`git diff --check`。Rust fmt、clippy 与 workspace test 此前完成通过。

## 2026-10-02：原生 Splash 启动调试

- 主动运行 `vp run --filter app dev`，复现运行时引入 Vite Node 模块导致的语法错误；为 plugin 增加独立 Vite 构建与导出入口。
- 修正应用 SWC 装饰器 transform 对 Vue TSX 的处理范围，消除 React 调用错误。
- 开发环境启用 JS trace 日志与原生应用 DEBUG 日志，添加主入口模块加载失败捕获和 splash 初始化日志。
- 原生两次启动均完成插件预加载、前端挂载及主窗口显示调用；继续验收可见页面。
- 当前通过：18 项专项 Web 测试、13 项 Rust logger 测试、logger clippy、Rust fmt、无缓存 lib-build、全仓无缓存递归 typecheck、vp check。
- 全仓测试通过 180 files / 954 tests，codegen 检查通过。原生窗口经截图与实际操作确认显示启动插图、插件管理页和启动后的登录弹窗；用户确认验收足够并要求收尾提交。
- 修正生产 legacy 构建中 artifact URL 表达式被内联的问题，plugin-install 专项测试通过 6 files / 30 tests。
- 已停止原生调试进程；生成 bindings 经格式工具恢复至原有内容。
- 最终无缓存 lib-build、vp check、plugin-install 专项测试和 app build:web 全部通过；git diff 检查通过，启动调试完成。
# 2026-10-02 原生 Cordis 与 JSON 流程重构

## 2026-10-02 依赖升级兼容修复

- 已核对升级提交与 AGENTS.md；vp install 成功。
- 开始同步 Vite+ 1.0 任务配置、vite-plus/test 导入及根依赖版本管理。
- 已同步测试导入与 cache.output，将局部依赖版本集中到根配置；覆盖率插件对齐 Vitest 5.0.1。
- vp install 与 vp check --fix 通过；构建发现 dts.oxc 参数变化，已改为对象。Rust 正在编译升级依赖。
- lib-build 和 macOS cargo check 通过；已修正插件 Vite hook 与 JNI 0.22 桥接。
- 已同步 tsdown 和 tauri-v2 技能说明；首轮全量测试两个超时用例在单 worker 专项通过。
- 技能同步已签名提交 216ea529、77771065，覆盖构建、Tauri、Cloudflare、Wrangler、Elysia 和 Cordis 的仓库约定，校验通过。
- 确认 Vue 类型工具上游回归并固定到 3.3.11，应用专项类型检查通过；应用生产构建通过。
- 固定路由与组件声明在各子包生成，移除对应全局忽略规则；冻结安装通过，继续串行 Web 验证。
- Rust fmt、全仓与 Android 目标 Clippy、132 项 Rust 测试通过。
- 最终串行 lib-build、格式 lint、无缓存递归 typecheck、代码生成和 diff 检查通过。
- 全量覆盖率验证 155 files / 833 tests 全部通过，行 84.25%、函数 79.30%、分支 73.85%、语句 81.60%，日志无错误或警告。
- 根目录声明在构建、类型检查与全量测试后均不存在；子包声明已恢复跟踪，本轮修复签名提交保存。

- 阶段 3 已签名提交 `d23ed6dc`，阶段 4 共享包装器与 SDK 清理已签名提交 `22eb690c`。
- 服务端修正每次调用的 D1/HTTP 预算；流程写入失败也释放 Context。真实 D1 专项 6 tests 通过。
- 客户端修正内置保留 ID 与无效安装元数据，应用内管理按 ID 展示并支持停用。宿主专项 6 tests 通过。
- 新增 workerd CPU profiler、真实本地 D1/HTTP 测量，3 个场景各预热 5 次、测量 30 次；资源数据和测量边界记入 `docs/plugin-flow-acceptance.md`。
- Rust fmt/clippy/workspace test 已通过，共 132 单元测试，1 个既有文档示例跳过。客户端元数据修复后的实际启动复核与最终串行 Web 检查正在进行。
- 预算与现场修正已签名提交 `8e017cdc`。首次全量测试发现 11 项相关测试夹具未同步；更新配置列、新 manifest、原生内容集合、Tauri 下载事件和发布任务顺序，专项 9 files / 50 tests 全部通过。
- 测试夹具同步已签名提交 `99ebbe6d`。最终串行构建、check、typecheck、全量测试（155 files / 833 tests）、codegen 与 diff 检查通过。
- Web 实际验证 ZIP 安装、热替换失败清理、保存启用状态和界面手动恢复；390px 页面展示正常。Tauri 单可见主窗口自动进入首页，安全模式管理页正确展示无效元数据和错误来源。
- Web 实际卸载发现 IndexedDB 键游标删除抛出 InvalidStateError；修正为对象仓库按主键删除，继续复核更新与卸载。
- IndexedDB 修正后的真实 ZIP 安装、1.0.0 到 2.0.0 更新和卸载通过，core 持续 ACTIVE，临时包资源释放。宿主与文件存储专项 2 files / 10 tests 通过。浏览器最终无运行错误，剪贴板权限与框架实验性提示属于现场警告。
- IndexedDB 修正已签名提交 `7735889e`。19:14 最终串行 lib-build、check、递归 typecheck、全量测试（155 files / 833 tests）、codegen 和 diff 全部通过；本轮四阶段完成，资源测量及生产 CPU 边界见验收报告。

- 已读取当前规划、插件技能和历史验证经验，确认用户实施授权及干净工作树。
- 已建立本轮四阶段执行计划；开始协议、Context 服务和安装构建链核对。
- 已迁移内容、用户、远程资源及分享类型到客户端 SDK，新增原生 Context 服务与调用方 effect 清理；Cordis 已加入 UMD 桥接，客户端 SDK 加入宿主 ESM 桥接。
- 原生服务与桥接专项验证 2 files / 20 tests 通过；继续补提供者停用恢复验证。
- 初版测试使用 Object.assign 写函数 name 时触发只读属性错误，已改为具名函数；格式检查提示四文件需格式化，已运行 vp check --fix。
- 第一阶段当前仍在进行，下一步迁移 manifest v2、安装记录及函数数组模块读取，然后接入 composition 与内置插件。
- 阶段 1A 验证：lib-build、vp check --fix、SDK 与聚合包 typecheck 通过；原生服务及构建桥接 2 files / 21 tests 通过，包含逆序服务加载、提供者停用与恢复。将本子阶段签名提交，继续阶段 1B。
- 阶段 1A 初次提交被 cspell 拦截，发现记录中的上游仓库标识已改为可识别的完整 URL。
- 阶段 1B 已迁移 manifest v2、安装记录配置、函数数组模块读取、包父 Fiber、内置插件和 HMR。安装模块 6 files / 23 tests 通过，聚合包生产类型检查通过。
- 阶段 2 已将 Web 入口和 Tauri 单可见主窗口接入应用，应用内管理展示启用保存值、Fiber 状态与故障来源，提供 JSON 配置编辑和安全模式逐个启用。继续应用与生命周期验证。
- 客户端安装/管理专项 21 files / 115 tests 通过；新增 Config、失败修复、配套 JSON 与纯服务端打包用例通过。client/install/Vite/app 类型检查和全仓格式 lint 通过。
- Web 实际加载首页及应用内插件页面；修复宿主下载器实例重名，Web 按平台条件启动下载生命周期。Tauri 实际启动与最终串行验收留在阶段 4。
- 更新客户端原生 Context/Fiber 架构说明，签名保存阶段 1B 与阶段 2 实现，开始服务端 JSON 流程。

## 2026-10-03：双端拆分启动

- 已确认现有工作树干净，旧应用同时包含移动/桌面布局与 Rust 平台行为。
- 最小修改范围为客户端应用、共享 UI 的端布局 token、runtime 输出、构建/版本/CI 路径及对应测试。

- 共享 core 范围扩展到布局差异较小的组件：插件配置/市场、搜索、收藏卡片、下载操作和 Vapor 片段，共 31 个 SFC；图标资源同步共用。

## 2026-10-03 双端拆分与局部 Vapor 验证

- 移动端应用已迁移至 `packages/client/app/mobile`，桌面端位于 `packages/client/app/desktop`，共享业务与布局影响较小的组件位于 `packages/client/app/core`，共享 Rust 原生边界位于 `packages/client/app/core`。
- 两端已分别完成 Web 构建；Vapor 编译能力在生产配置启用，测试环境使用常规 Vue 编译以兼容 happy-dom，Vapor 组件覆盖下载信息与日志文本片段。
- `vp run -r typecheck`、`vp check`、`vp test run`、`cargo fmt --all --check`、严格 Clippy、workspace Rust tests、`vp run codegen:check` 均通过。
- Android downloader Gradle 校验已运行；当前生成的 `tauri-android` 工程在 AGP 8.11.0 下没有可消费 variant，`lintReportDebug` 因该工程配置失败，需在重新生成 Android 工程后复核。

## 2026-10-03：内化 HTTP 插件

- 从 `tauri-plugin-better-cors-fetch` 1.8.0 clone 到 `packages/client/platform/http`，移除嵌套 `.git` 与独立项目工程化文件。
- Rust crate 内化为 `tauri-plugin-http`，TypeScript 包内化为 `@delta-comic/http`，Tauri IPC 命名空间与 capability 更新为 `http`。
- desktop/mobile/core、workspace Cargo、pnpm、Vite+ 构建、TypeScript project references、版本同步脚本已完成迁移。
- 包构建、包类型检查、包测试（3 files / 9 tests）、双端相关测试（32 files / 139 tests）、Rust fmt、包级 clippy/check 已通过。
# 2026-10-04 TauRPC IPC migration

- 用户批准并要求实现 TauRPC 全量自有 IPC 重构计划。
- 已完成只读盘点：七个自有 Rust plugin/host command 域、前端动态 invoke、HTTP Specta bindings、downloader raw events、capability/permission 生成链。
- 已核对 TauRPC 0.8.2 API：procedures/resolvers、Router::merge、Exporter、typed events、Channel、TauRPC__ 命令前缀；TauRPC 仍使用 Specta v2，并绕开旧 Tauri Specta bridge。
- 关键约束：TauRPC procedure 不能直接返回 tauri::ipc::Response；HTTP Webview ResourceTable 需改为自有 request registry；Vec<u8> 走 JSON number[]。
- 当前阶段：依赖与基础 Router。
- 已更新根 Cargo/pnpm workspace 依赖、app/core `rpc_router`/`AppApi`/exporter，以及 mobile/desktop 对七个 bindings exporter 的 debug 接线。
- 已并行委派 simple plugin、HTTP、downloader 三个包域的 TauRPC 迁移，宿主文件由主 agent 收口。

## 2026-10-04 TauRPC 全量自有 IPC 重构续接

- 接续已有子代理迁移结果，确认 `d027866c` 已在当前历史中，工作树仍有未提交 TauRPC 迁移文件。
- 下一步先清理旧 IPC 残留与权限文件，再按仓库顺序执行完整验证并签名保存。

## 2026-10-04 TauRPC 全量自有 IPC 重构验收

- 完成 app、http、downloader、logger、utils、db、plugin 七个域的 TauRPC procedures、resolvers、typed events、exporters 与前端 bindings；app/core 统一合并 Router，desktop/mobile 注册唯一 TauRPC invoke handler。
- HTTP 使用请求 registry、取消状态与 `BodyChunk`/JSON `number[]`；downloader 使用 typed RPC/events，默认 proxy 延迟创建以支持无 WebView 的宿主测试。
- 清理自有插件 command handler、旧权限文件、旧 bindings、业务层动态 invoke 与旧 Specta bridge 依赖；官方 SQL plugin 测试调用保留。
- `vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run`（172 files / 899 tests）、`cargo fmt --all --check`、`cargo clippy --workspace --all-targets --locked -- -D warnings`、`cargo test --workspace --locked -- --test-threads=2` 与 `git diff --check` 均通过。
- 修复 HTTP fetch Rust clippy 的 needless borrow，并复核 db 与 plugin 生命周期测试；当前待创建签名提交。

## 2026-10-04 TauRPC runtime 修复

- 修复 desktop debug 启动时 HTTP bindings exporter 在 Tokio runtime 外合并 TauRPC handler 导致的 reactor panic。
- app/core 统一 Router 与 HTTP exporter 在 `tauri::async_runtime::handle().inner().enter()` 作用域内合并 handler；各 exporter 统一裁剪尾部空行，保持 bindings 内容稳定。
- 新增 Router 构造回归测试；desktop 二进制已启动至 `application runtime ready`。
- HTTP/native Rust 定向测试、clippy、fmt 均通过。
