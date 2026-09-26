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
- **状态：** in_progress
- 确认 client/server/both 公共 SDK、Cordis host integration、插件包/manifest/runtime 协议、客户端 UI/layout/player/model、服务端 Worker/D1/API/资源与配额、AI 调试、应用/admin 与数据范围。
- 依据用户答案更新 `findings.md` 和 `progress.md`，未明确事项不得擅自变成硬性要求。

### 阶段 3：比较架构方案并分段获得批准
- **状态：** pending
- 提出 2–3 个总体方案，说明边界、依赖、迁移/发布与风险取舍，给出推荐。
- 按设计章节分段呈现：目标与拓扑、workspace/包边界、插件协议与运行时、可观测性、应用与数据迁移、构建发布验证。
- 每个设计段落取得用户认可后再继续；重大取舍仍由用户决定。

### 阶段 4：撰写、自审、提交设计 spec 并等待审核
- **状态：** pending
- 写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。
- 检查占位符、内部一致性、范围、术语与需求歧义，修订至完整。
- 按仓库约定签名提交 spec，并请用户审核；收到用户批准之前不进入实施计划。

### 阶段 5：制定实施计划并按阶段实施
- **状态：** pending
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

## Next Step

准备一张集中问题表，优先确认 SDK/Manifest 包依赖关系、Cordis Loader 与虚拟模块协议、客户端扩展 API、服务端安装/权限/资源上限和 D1 生命周期等剩余关键需求，并将答案写入 findings/progress。
