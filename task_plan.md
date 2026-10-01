<!-- cspell:ignore deepseek Cordis subrequest -->

# Delta Comic 全仓架构重构规划

## 目标

完成 Delta Comic 全仓架构重构的需求发现、方案设计与分阶段实施。参考仓库上一级目录的 `/Users/wenxig/Documents/deepseek-harness` 中 Cordis 与 capability-family monorepo 组织方式。保留既有产品能力，允许数据库迁移，不承诺旧插件/API 兼容；依赖升级至最新版本（包含预发布版本）。最终公共 npm SDK 包包括 `@delta-comic/both`、`@delta-comic/client`、`@delta-comic/server`。

当前用户切换 build mode 的目的，是将规划持久化。架构设计审批流程仍然有效：需求与重大决策明确后，先提出 2–3 个方案并分段确认设计；设计获批后编写并提交设计 spec，等待用户审阅批准，然后才制作实施计划及开始实现。

## 阶段

### 阶段 1：持久化规划和已确认决策
- **状态：** complete
- 在仓库根目录维护 `task_plan.md`、`findings.md`、`progress.md`。
- 汇总现有背景、用户决策、设计大纲和未决事项。
- 每轮允许以普通对话表格集中询问多个高影响问题；禁止调用 OpenCode ask question/question 工具。

### 阶段 2：完成能力盘点和需求确认
- **状态：** complete
- 确认 client/server/both 公共 SDK、Cordis host integration、插件包/manifest/runtime 协议、客户端 UI/layout/player/model、服务端 Worker/D1/API/资源与配额、AI 调试、应用/admin 与数据范围。
- 用户通过 40 项架构决策批量确认了包协议、模块加载、客户端/服务端 API、安装/诊断、应用/文案/发布等核心需求。
- 已将 40 项决策追加到 `findings.md` 的"已确认的 40 项架构决策"章节，并更新剩余未决问题清单。

### 阶段 3：比较架构方案并分段获得批准
- **状态：** complete
- 提出 2–3 个总体方案，说明边界、依赖、迁移/发布与风险取舍，给出推荐。
- 按设计章节分段呈现：目标与拓扑、workspace/包边界、插件协议与运行时、可观测性、应用与数据迁移、构建发布验证。
- 每个设计段落取得用户认可后再继续；重大取舍仍由用户决定。

### 阶段 4：撰写、自审、提交设计 spec 并等待审核
- **状态：** complete
- 写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。
- 检查占位符、内部一致性、范围、术语与需求歧义，修订至完整。
- 按仓库约定签名提交 spec，并请用户审核；收到用户批准之前不进入实施计划。

### 阶段 5：制定实施计划并按阶段实施
  - **状态：** in_progress
- 仅在用户批准 spec 后制定可执行的分阶段实施计划。
- 按阶段执行，每个阶段完成后立即验证并签名提交保存进度。
- 遵循 `AGENTS.md` 的 Vite+、Rust、依赖、格式、测试、i18n 及发布约定，并记录用户特别确认的例外。

## Decisions Made

- 保留现有产品能力；允许数据库迁移；旧插件和 API 不承诺兼容。
- 目标端：Tauri 桌面与 Tauri 移动端；移除浏览器 Web 客户端产品目标。
- 下载器复用现有实现，针对新架构修补接入，不重写。
- Cordis 使用上游 npm 包；Delta Comic SDK 通过共享包统一 re-export/约束兼容版本。
- 客户端插件完全可信，在 Cordis 通信系统内运行，不沙箱，默认拥有客户端完整能力。
- 服务端插件运行期不可信；每个用户安装实例独立 Worker 和 D1；通过 Workers for Platforms 动态 dispatch 隔离。
- 服务端插件导出 Cordis plugin/plugin set；平台 Worker 创建 Cordis runtime、Context、Registry、Loader 和 fetch 适配。
- 最终公共 SDK：`@delta-comic/both` 放平台无关协议与 Cordis；`@delta-comic/client` 和 `@delta-comic/server` 分别承载平台 API。
- 客户端和服务端 Manifest 共享精简核心协议，各有可选的平台扩展；客户端插件可依赖自己的云服务，不要求服务端配套。
- 插件产物由作者预构建；外部来源包括任意 URL/Git release/private source/local directory；服务端提交预构建 ESM Worker bundle 与 manifest。
- 资源使用 manifest 声明的 SHA-256 校验，不引入发布者签名。
- 用户要求当前插件文本放弃 i18n、允许硬编码；其适用边界待确认，且需在最终设计中明确。
- 用户明确要求先列大纲、再持续澄清；可以一轮用表格集中提出大量问题；不得使用 OpenCode question 工具。
- 现阶段只将架构规划持久化，不代表实现获批。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| 初次调用 planning-with-files 技能时仓库内不存在规划文件 | 1 | 新建根目录规划文件，作为本任务唯一的持久规划来源 |

## 阶段 6：完成剩余架构清单

- **状态：** in_progress
- 6A：将新 Artifact/Manifest 接入现有安装文件与模块读取边界。complete（`b33ab532`）
- 6B：公开构建并发布 `@delta-comic/server`，补齐 SDK 的产物测试。complete（`e9a83b1e`）
- 6C：接入 Tauri command 的 specta 类型生成，并纳入 Rust/TypeScript 验证。complete（`127dd91b`）
- 6D：完成客户端/服务端宿主迁移、诊断 harness、UI/网络/下载器能力迁移。已完成下载器、UI EnvironmentRegistry、诊断 harness、客户端网络 transport、UI registrar 接口、app 路由/导航/command 接线、Worker fetch/scheduled 诊断适配器，以及旧 D1 插件宿主到新 ServerRuntime 的桥接工厂；旧 StaticPluginExecutor 全量迁移仍未完成。
- 6E：完成 Worker dispatcher、D1 migration、发布/市场、应用/admin 重组与部署文档。已增加 artifact migration 声明与 ServerRuntime ID 核对/执行边界、Worker fetch/scheduled dispatcher 边界、按 plugin/installation 记录并幂等执行 SQL migration 的 runner，以及市场目录协议、内存/HTTP/R2 存储、HTTP handler、发布器、受授权发布/撤回端点和部署运维边界；发布者身份、并发 CAS、签名凭证、artifact 上传、完整发布工作流、应用/admin 重组与完整部署流水线仍未完成。
- 6F：完成 workspace 目录稳定化。complete：workspace 仅保留 `packages/*/*/*`，13 个现有包已落位到 client/server/shared 能力域，lockfile、symlink、构建入口、测试项目和 operational 路径已同步；市场管理界面保持暂停。
- 每个子阶段必须有实现、测试、规划状态和签名提交；未实现事项保持未勾选。

## Next Step

  阶段 6G Install 与 Vite Adapter 已完成；后续继续处理 6D/6E 的完整旧宿主迁移、发布身份/CAS、WfP provisioning、应用/admin 重组和完整部署流水线。

## 阶段 6G 实施计划

1. **Kernel/Loader 基础包（complete）**：创建三级 workspace 包与独立构建入口；迁移 kernel 全部 source-agnostic 类型、依赖规划、capability pipeline、contribution hub、scope；将 `LoadedPluginModule` 与 `PluginModuleReader` 迁移到 loader，更新 API/Manifest 类型引用与测试。专项构建、类型检查和包内测试已通过。
2. **Runtime 包（complete）**：迁移 engine/providers/store；将 runtime 依赖收敛到 api、kernel、loader 与必要的 Vue/logger peer；更新 Runtime 测试和聚合包导入。聚合 composition 已通过边界 adapter 接入旧 Install reader 与 capabilities，旧聚合 Runtime 实现及测试已删除。
3. **Install 包（complete）**：迁移 contracts/service/source/codec/moduleReader/candidateProvider/artifactReader；数据库 archive repository、Tauri 文件存储和市场 client 留在聚合包 adapters/composition；Install build/typecheck 与 24 个专项测试通过。
4. **Vite Adapter 包（complete）**：迁移 Vite build/dev 实现与测试；保留 native HMR、CSS bridge、SFC style BFS、CORS/no-store 和 ZIP 产物行为；Vite build/typecheck 与 26 个专项测试通过。
5. **聚合包收敛（complete）**：composition 改用新 Install/Vite 包，聚合入口 re-export 新包，旧 `lib/install` 与 `vite` 源码和测试已删除。
6. **验证与提交（Install/Vite slice complete）**：已运行 `vp install`、`vp run lib-build`、专项 build/typecheck/test、聚合包测试、release workspace 测试、semantic release command 测试和 `git diff --check`；全仓 `vp check`、递归 typecheck、全量测试和 codegen 检查留待 6D/6E 后续清单。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `writing-plans` 技能不在当前可用技能列表 | 1 | 按已批准 6G spec 在本文件记录等价的分阶段实施计划，继续执行既定流程 |
| app `vue-tsc` 报告旧 `DCPluginConfig` model/hooks 字段缺失 | 1 | 聚合包已恢复可解析；记录为 6D 旧宿主类型迁移遗留，不扩大本次 6G Install/Vite 包拆分范围 |
| 聚合包架构测试将多行 `export type` 续行误判为可执行代码 | 1 | 聚合入口改为通过 `lib/kernel` 统一导出新 Kernel，并移除旧 Kernel 的重复实现 |
| 插件专项测试在依赖 dist 尚未重建时无法解析 `@delta-comic/plugin-kernel` | 1 | 先运行 `vp run lib-build`，再重新执行专项测试并通过 |

## 6G 过渡设计清理

- 聚合包能力已直接使用 `@delta-comic/plugin-kernel` 的 `CapabilityModule`、`ActivationPipeline` 和 `PluginScope`。
- 删除聚合包重复的 candidate/capability/dependency/scope 实现、运行时 capability adapter 及其重复测试；插件特有的多 channel `ContributionHub` 保留为宿主能力服务。
- 更新运行时进度报告以消费新 Kernel 的 capability state 事件，移除旧报告结构。
