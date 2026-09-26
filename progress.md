<!-- cspell:ignore Cordis deepseek subrequest specta -->

# Delta Comic 架构重构规划进度

## 会话记录

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

- 当前阶段：阶段 5 实施，公共协议已完成。
- 代码实现：both 公共 Manifest、artifact 校验、诊断记录器和 Cordis runtime harness 已完成并通过专项验证。
- 设计 spec：已由根目录 ARCHITECTURE.md 与 findings.md 承载并获用户批准。
- 下一个动作：实现 client/server 最小 SDK/runtime 与示例。

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

## 验证

- 本次仅创建规划文档，未运行应用检查/测试。
- 创建前确认仓库工作区干净，仓库根目录不存在 `task_plan.md`、`findings.md`、`progress.md` 或 `.planning` 规划文件。
- 提交前 hook 自动验证 codegen、`vp check --fix`、codegen check 与 cspell 全部通过。
