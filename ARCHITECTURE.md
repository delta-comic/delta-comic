<!-- cspell:ignore Cordis subrequest specta -->

# Delta Comic 架构

客户端是 Vue/Tauri 应用，共用 Web 与原生前端入口。应用启动后进入主界面，设置与插件管理
随应用外壳初始化。Tauri 使用可见的 `main` 窗口，权限绑定该窗口。

## 应用与工作区

| 路径 | 职责 |
| --- | --- |
| `packages/app/mobile` | 移动端 Vue/Tauri 应用、路由与三语 i18n |
| `packages/app/desktop` | 桌面端 Vue/Tauri 应用、路由与窗口行为 |
| `packages/app/core` | 双端共享业务状态、组件、插件初始化与生命周期协议 |
| `packages/core/sdk` | `@delta-comic/client` 类型、Context 扩展与平台客户端工具 |
| `packages/plugin/core` | 宿主服务、内置插件、安装组合与 Fiber 管理 |
| `packages/plugin/install` | 来源、安装记录、ZIP、模块读取与开发服务器 |
| `packages/plugin/artifact` | 客户端资源与模块图完整性校验 |
| `packages/plugin/vite` | 插件构建、ZIP 输出、CSS 与 HMR 协议 |
| `packages/core/runtime` | `@delta-comic/runtime` UMD 宿主模块桥接 |
| `packages/core/model` | 内容模型 |
| `packages/core/utils` | 客户端工具 |
| `packages/platform/db` | 客户端 SQLite/Web 数据库和生成表类型 |
| `packages/platform/downloader` | 原生下载 |
| `packages/platform/http` | HTTP 平台适配 |
| `packages/core/logger` | 日志传输 |
| `packages/ui/ui` | 通用 Vue UI、内容布局和播放器 |
| `packages/core/sdk` | 插件 SDK、Cordis 导出与诊断协议 |
| `packages/core/logger` | 双端日志核心 |
| `packages/plugin/manifest` | 客户端 manifest v2 schema 与完整性检查 |

客户端公共模块由各端实际消费。`@delta-comic/runtime` 为外部插件提供宿主桥接。

## Manifest 与产物

`@delta-comic/manifest` 提供 TypeBox schema，协议版本为 `2`。插件包提供客户端入口：

```json
{
  "protocolVersion": 2,
  "id": "example",
  "name": "Example",
  "version": "1.0.0",
  "author": "Example Author",
  "description": "Example package",
  "client": { "entry": "index.js" },
  "resources": [
    {
      "path": "index.js",
      "mimeType": "text/javascript",
      "integrity": "sha256-<base64>",
      "imports": []
    }
  ]
}
```

核心字段包括 ID、名称、版本、作者、描述、图标和资源清单。可选 `apiVersion` 与
`cordisVersion` 表达宿主版本范围。`resources` 描述资源路径、MIME、SHA-256、导入图及
可选平台条件。

启用状态、用户配置、来源和定时设置保存在客户端安装记录。安装器校验协议、路径、资源完整性
与客户端入口。客户端安装支持本地 ZIP、HTTP、GitHub release、市场与 `dev:<port>`；模块读取器
处理 ESM 图、Blob/资源 URL、CSS 和释放。构建桥接使 Cordis、Vue、SDK 和 UI 使用宿主实例。

## 客户端 Context 与插件

每个应用会话使用一个原生 `Context`。宿主先初始化平台服务、配置、i18n、用户集合和应用 UI，
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

函数使用原生 `name`、`inject`、`provide` 和 `Config` 元数据。Cordis 原生 `resolveConfig`
校验配置。包 Fiber 挂载所有子函数后等待其稳定，缺失服务的插件保持 `PENDING`。提供者停用、
恢复和替换通过 Cordis 的服务协调触发依赖消费者卸载与重载。

`pluginFibers` 保存包 ID 与父 Fiber。启用、停用、重载、配置、更新与卸载统一操作这棵树。内置
插件由 `builtins/*.builtin.ts` 文件发现，采用同一入口契约；宿主基础服务的生命周期覆盖整个会话。

| Context 服务 | 内容 |
| --- | --- |
| `config` | 安装配置与设置 |
| `i18n` | 插件文案注册与翻译 |
| `ui` | 路由、导航、命令、环境组件 |
| `content` | 内容集合与模型注册 |
| `user` | 本地用户集合与插件收藏同步 |
| `remote` | 远程资源集合 |
| `share` | 分享集合 |
| `network` | 网络客户端 |
| `downloader` | 下载与平台适配 |
| `database` | 类型安全数据库访问 |
| `diagnostics` | 诊断记录 |

集合由服务持有，注册通过调用方的 `ctx.effect()` 绑定 Fiber。卸载释放集合条目、模型、UI、文案
与其它效果。数据库表由 codegen 类型覆盖，网络与下载复用现有平台适配。

### 启动与安全模式

Web 入口为 `src/main.ts`，Tauri 入口为 `src-tauri/src/main.rs`，窗口加载同一前端。应用内
插件页面展示持久启用状态、当前 Fiber 状态与错误来源，并提供安装、启停、配置、更新和卸载。

模块加载失败或可管理插件 Fiber 进入 `FAILED` 时，本轮加载停止，并单次卸载全部可管理插件。
应用外壳持续运行；持久启用记录保留，下一次启动重新尝试。普通业务调用错误展示对应错误，
生命周期错误触发整组清理。清理异常进入诊断。

宿主应用文案维护 `en-US`、`zh-CN` 与 `zh-TW`，共享 UI 消息通过应用 `ui.*` 桥接。

## 数据、目录与诊断

数据定义源为 `script/codegen/src/client.table.ts`，生成文件由 codegen 更新。插件市场由客户端安装器
读取本地 ZIP、HTTP、GitHub release 或开发服务器资源。

`DiagnosticRecorder` 提供有界记录和快照。客户端摘要写入本地 `plugin_diagnostic_log`，按插件
保留近期记录。

## 构建、验收与发布

工作区采用 Node 26.10.0、pnpm 12.0.0-rc.3、Vite+；Rust 使用 `1.100.0` stable 与最新 nightly。公共包
版本通过 `vp run set-ver -- <version>` 统一更新，发布拓扑与 dry run 见 `docs/release-workflow.md`。

串行验收顺序：

```sh
vp run build:packages
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
