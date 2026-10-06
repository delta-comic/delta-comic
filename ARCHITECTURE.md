<!-- cspell:ignore Cordis subrequest specta jsonlogic -->

# Delta Comic 架构

本文描述 2026-10-02 原生 Cordis 与 JSON 流程重构后的实现。历史设计与阶段记录位于
`docs/superpowers`、`task_plan.md`、`progress.md` 和 `findings.md`。

## 应用与工作区

客户端为 Vue/Tauri 应用，共用 Web 与原生前端入口。应用启动后进入主界面，设置与插件管理
随应用外壳初始化。Tauri 使用一个可见的 `main` 窗口，权限绑定该窗口。

服务端为 Elysia Cloudflare Worker，共享一个 D1 数据库。认证、同步、插件流程、健康检查、
管理 API 和可选 R2 插件目录均由该 Worker 提供。管理端为独立 Vue 应用，通过
`src/features/*/feature.ts` 发现功能模块。

| 路径 | 职责 |
| --- | --- |
| `packages/client/app/mobile` | 移动端 Vue/Tauri 应用、路由、三语 i18n、应用内管理 |
| `packages/client/app/desktop` | 桌面端 Vue/Tauri 应用、路由、侧栏与窗口行为 |
| `packages/client/app/core` | 双端共享业务状态、功能 composables 与布局影响较小的组件 |
| `packages/client/app/core` | 双端共享 Rust Tauri 命令、插件初始化与生命周期协议 |
| `packages/client/core/sdk` | `@delta-comic/client` 类型、Context 扩展、平台客户端工具 |
| `packages/client/core/plugin` | 宿主服务、内置插件、安装组合与 Fiber 管理 |
| `packages/client/core/plugin-install` | 来源、安装记录、ZIP、模块读取、开发服务器 |
| `packages/client/core/plugin-artifact` | 客户端资源与模块图完整性校验 |
| `packages/client/core/plugin-vite` | 插件构建、ZIP 输出、CSS 与 HMR 协议 |
| `packages/client/core/runtime` | `@delta-comic/client-core-runtime` UMD 宿主模块桥接 |
| `packages/client/core/{model,utils}` | 内容模型、客户端工具 |
| `packages/client/data/db` | 客户端 SQLite/Web 数据库和生成表类型 |
| `packages/client/platform/{downloader,logger}` | 原生下载、日志传输 |
| `packages/client/ui/ui` | 通用 Vue UI、内容布局和播放器 |
| `packages/server/core/server` | `@delta-comic/server` SDK、云 API 与 Worker 实现 |
| `packages/server/admin/panel` | 管理应用 |
| `packages/shared/core/{both,logger}` | Cordis 导出、诊断协议、双端日志核心 |
| `packages/shared/plugin/manifest` | 双端 manifest v2 schema 与兼容性检查 |

共享模块由两端实际消费。宿主实现归属对应端；模块读取契约位于安装模块。
`@delta-comic/client-core-runtime` 的职责是外部插件依赖桥接。

## Manifest 与产物

`@delta-comic/shared-plugin-manifest` 提供 TypeBox schema，协议版本为 `2`。两端 SDK 导出同一协议。

```json
{
  "protocolVersion": 2,
  "id": "example",
  "name": "Example",
  "version": "1.0.0",
  "author": "Example Author",
  "description": "Example package",
  "client": { "entry": "index.js" },
  "server": { "entry": "flows.json" },
  "resources": [
    {
      "path": "index.js",
      "mimeType": "text/javascript",
      "integrity": "sha256-<base64>",
      "imports": []
    },
    {
      "path": "flows.json",
      "mimeType": "application/json",
      "integrity": "sha256-<base64>",
      "imports": []
    }
  ]
}
```

至少提供一个端入口；同一个包可提供两端入口。核心字段包括 ID、名称、版本、作者、描述、
图标和资源清单。可选 `apiVersion` 与 `cordisVersion` 表达宿主版本范围。
`resources` 描述资源路径、MIME、SHA-256、导入图及可选平台条件。

启用状态、用户配置、来源和定时设置保存在各端安装记录。安装器校验协议、路径、资源完整性
与端入口。客户端运行依赖使用函数的 `inject`，服务端操作由宿主提供。

客户端安装支持本地 ZIP、HTTP、GitHub release、市场与 `dev:<port>`。资源准备后切换安装记录；
模块读取器处理 ESM 图、Blob/资源 URL、CSS 和释放。开发服务器提供 manifest、模块与 CSS，
HMR 事件交由宿主替换对应包 Fiber。构建桥接使 Cordis、Vue、SDK 和 UI 使用宿主实例。

## 客户端 Context 与插件

每个应用会话使用一个原生 `Context`。宿主先初始化平台服务、配置、i18n、管理和应用 UI，
再加载启用插件。安装包默认导出 `readonly Plugin.Function<Config>[]`。

```ts
import type { Context, Plugin } from 'cordis'
import type {} from '@delta-comic/client'

function example(ctx: Context, config: Record<string, unknown>) {
  ctx.ui.registerCommand('example.refresh', () => {
    ctx.diagnostics.record('info', 'example refresh', { config })
  })
}

Object.assign(example, { inject: ['ui', 'diagnostics'] })
export default [example] satisfies readonly Plugin.Function[]
```

函数使用原生 `name`、`inject`、`provide` 和 `Config` 元数据。Cordis 原生
`resolveConfig` 校验配置。包 Fiber 挂载所有子函数后等待其稳定，缺失服务的插件保持
`PENDING`。提供者停用、恢复和替换通过 Cordis 的服务协调触发依赖消费者卸载与重载。

`pluginFibers` 保存包 ID 与父 Fiber。启用、停用、重载、配置、更新与卸载统一操作这棵树。
内置插件由 `builtins/*.builtin.ts` 文件发现，采用同一入口契约；宿主基础服务的生命周期
覆盖整个会话。

| Context 服务 | 内容 |
| --- | --- |
| `config` | 安装配置与设置 |
| `i18n` | 插件文案注册与翻译 |
| `ui` | 路由、导航、命令、环境组件 |
| `content` | 内容集合与模型注册 |
| `user` | 用户集合与鉴权 |
| `remote` | 远程资源集合 |
| `share` | 分享集合 |
| `network` | 网络客户端 |
| `downloader` | 下载与平台适配 |
| `database` | 类型安全数据库访问 |
| `diagnostics` | 诊断记录 |

集合由服务持有，注册通过调用方的 `ctx.effect()` 绑定 Fiber。卸载释放集合条目、模型、
UI、文案与其它效果。数据库表由 codegen 类型覆盖，网络与下载复用现有平台适配。

### 启动与安全模式

Web 入口为 `src/main.tsx`，Tauri 入口为 `src-tauri/src/main.rs`，窗口加载同一前端。
应用内插件页面展示持久启用状态、当前 Fiber 状态与错误来源，并提供安装、启停、配置、
更新和卸载。

模块加载失败或可管理插件 Fiber 进入 `FAILED` 时，本轮加载停止，并单次卸载全部可管理插件。
应用外壳和管理服务持续运行；持久启用记录保留，下一次启动重新尝试。用户可在本次安全模式
逐个手动启用。普通业务调用错误展示对应错误，生命周期错误触发整组清理。清理异常进入诊断。

宿主应用文案维护 `en-US`、`zh-CN` 与 `zh-TW`，共享 UI 消息通过应用 `ui.*` 桥接。

## 服务端 JSON 流程

`@delta-comic/server` 包根提供流程类型、schema 与 Cordis Context 扩展；
`@delta-comic/server/api` 为云 API 客户端子入口。Worker 实现在 `app` 下。

认证中间件产生 `auth.userId`，该值决定租户。JSON 安装接口校验 manifest、流程 schema、
操作、表达式和完整性后写入 D1；下一次调用读取当前记录。

```json
{
  "version": 1,
  "flows": [
    {
      "id": "main",
      "steps": [
        {
          "id": "write",
          "op": "store.set",
          "key": "value",
          "value": { "expr": { "var": "input.value" } }
        },
        {
          "id": "done",
          "op": "return",
          "value": { "expr": { "var": "steps.write" } }
        }
      ]
    }
  ]
}
```

流程 ID 在文档内唯一，步骤 ID 在流程内唯一。步骤顺序执行，`return` 结束流程。
普通 JSON 值保持字面值，显式 `{ "expr": JsonLogic }` 使用 `json-logic-js` 解释；
表达式数据包含 `input`、`config` 和已完成的 `steps` 结果，支持嵌套参数。

| 操作 | 参数与结果 |
| --- | --- |
| `if` | `condition`、`then`、可选 `else`；结果为匹配布尔值 |
| `http` | URL、方法、请求头、请求体；返回状态、头、JSON/text body 或 Response stream |
| `store.get` | 键；返回已保存 JSON 或 null |
| `store.set` | 键与 JSON 值；返回写入值 |
| `store.delete` | 键；删除结果为 null |
| `return` | 值；作为流程输出 |

每次请求或定时运行创建独立原生 Context，提供 `identity`、`input`、`flowConfig`、
`store`、`http` 和 `diagnostics`，挂载选中的执行函数。完成后释放 Context。
流式响应保持作用域至结束、错误或取消，完成记录由单次执行函数保存。

首版每个流程最多执行 64 步、分支深度 16、HTTP 16 次；每次 HTTP deadline 为 10 秒，
重定向以响应返回。任一步骤失败终止执行，记录错误及步骤 ID。文档上限 256 KiB，
表达式上限 16 KiB，表达式深度与运算符在安装时校验。

### D1 与调度

| 表 | 维度与内容 |
| --- | --- |
| `server_plugin_packages` | tenant/plugin：manifest、流程、配置、启用状态 |
| `server_plugin_schedules` | tenant/plugin：流程 ID、间隔、下次时间、启用状态 |
| `server_plugin_runs` | tenant/plugin/run：输入、结果、状态、步骤错误、指标 |
| `server_plugin_store` | tenant/plugin/key：JSON 值 |

查询使用租户与插件复合键。定时任务沿用 1–168 小时间隔，以 D1
`UPDATE ... RETURNING` 原子推进到期时间并领取任务。并发领取测试验证同一到期任务仅被领取一次。

管理端插件功能接受用户 access token，并提供 JSON 编辑、安装、配置、启停、定时、执行与记录。
管理概览使用流程表统计。管理员 token 继续用于目录发布、诊断和运营 API。

## 数据、目录与诊断

数据定义源为 `script/codegen/client.table.mts` 和 `script/codegen/server.table.mts`。
生成文件由 codegen 更新。服务端 `0005_plugin_flows.sql` 建立流程表，
`0006_remove_legacy_plugin_tables.sql` 完成表清理；既有历史迁移按序保留。

插件市场采用可选 R2 binding。目录支持 ETag 与条件写入，ZIP 上传按 SHA-256 校验并使用
`If-None-Match: *`。部署流程见 `docs/plugin-marketplace-deployment.md`。

`DiagnosticRecorder` 提供有界记录和快照。客户端摘要写入本地 `plugin_diagnostic_log`，
按插件保留近期记录。服务端流程持久化执行状态、指标与步骤错误，生命周期与清理诊断在本次
Context 内收集；宿主观测与归档回放使用管理 API。

## 构建、验收与发布

工作区采用 Node 25.9.0、pnpm 12.0.0-rc.3、Vite+；Rust 使用
`nightly-2026-08-12`。公共包版本通过 `vp run set-ver -- <version>` 统一更新，
发布拓扑与 dry run 见 `docs/release-workflow.md`。

串行验收顺序：

```sh
vp run lib-build
vp check
vp run -r typecheck
vp test run
vp run codegen:check
git diff --check
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked -- --test-threads=2
```

客户端验证覆盖函数数组、逆序注入、提供者恢复、失败清理、配置和热更新。
服务端验证覆盖更新生效、条件与结果引用、HTTP timeout、执行限制、租户隔离、原子定时领取、
流式结束和取消。资源测量及当前验收证据记录于 `docs/plugin-flow-acceptance.md`。
