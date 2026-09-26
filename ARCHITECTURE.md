# Delta Comic 插件系统架构设计

> **版本**: 1.0.0  
> **状态**: 设计定稿  
> **日期**: 2026-09-26

> **实现基线**：阶段 40A 已落地。现行 TypeScript API 以
> `packages/shared/both`、`packages/client/core/sdk` 和 `packages/server/lib` 为准。
> 本文早期第 5、6 章保留设计推导与迁移背景；其中出现的 `useDB()`、`useStore()`、
> `useDiagnostics()` 以及位置参数式 `registerRoute()` 属于历史伪代码，实际插件应使用
> `ctx.client`、`ctx.server` 和本文件第 12 章的 typed API。

## 摘要

Delta Comic 插件系统重构方案，采用 Cordis 作为统一的客户端/服务端插件框架，specta 作为类型基础设施，实现跨端一致的插件生命周期管理、类型安全的 API、AI 友好的诊断系统与最小侵入式的架构演进。

**核心技术栈**：
- 客户端：Tauri (桌面/Android) + Vue 3.6 RC (Vapor) + Cordis + Kysely
- 服务端：Cloudflare Workers (WfP) + D1 + Cordis + Kysely
- 类型系统：specta + tauri-specta（单一类型源派生多端类型）
- 日志：tslog (客户端) + pino (服务端)

---

## 第 12 章：阶段 40A 实现基线与示例

本章是当前代码的实现索引，覆盖已完成的公共协议、客户端 SDK、服务端 SDK、装饰器
诊断与验证方式。后续迁移完整 UI、下载器、同步服务和 WfP 平台适配时，必须保持本章
定义的边界。

### 12.1 公共包 `@delta-comic/both`

`packages/shared/both` 是平台无关的协议包，统一 re-export 上游 `cordis` 的核心类型，
并提供以下模块：

| 模块 | 当前职责 |
|---|---|
| `manifest` | `PluginManifestSchema`、依赖、入口类型、资源路径、MIME、SHA-256 integrity、imports 和 platform |
| `artifact` | 安全相对路径、资源图、重复/缺失文件、入口和 integrity 校验 |
| `diagnostic` | 有容量上限的 `DiagnosticRecorder`、`DiagnosticSnapshot`、`withDiagnostic` 和 `@diagnostic` |
| `runtime` | `CordisRuntime` 的 mount、unmount、list、snapshot、dispose harness |

Manifest 的入口默认是 ESM module：

```ts
const manifest = {
  protocolVersion: 1,
  id: 'demo.client',
  name: 'Demo client plugin',
  version: '1.0.0',
  entry: 'index.js',
  entryType: 'plugin',
  resources: [{
    path: 'index.js',
    mimeType: 'text/javascript',
    integrity: 'sha256-<base64>',
    imports: [],
    platform: 'client',
  }],
}
```

`validateArtifact()` 在动态 import 前完成 manifest 与文件集合校验。路径必须是安全的
相对路径；入口必须存在且被资源声明覆盖；每个声明资源必须有文件和匹配的 SHA-256
摘要；imports 必须指向 artifact 内已有资源。模块加载仍由宿主使用 Blob URL 与
`import()` 完成，宿主提供的 Cordis、SDK 和 UI 包在构建阶段 externalize、运行时注册。

### 12.2 诊断与装饰器

`DiagnosticRecorder` 保存有限数量的结构化记录，快照同时包含运行时、插件状态和记录。
同步/异步边界统一使用 `withDiagnostic()`；可声明为方法横切关注点的操作使用装饰器，
让业务方法保持处理逻辑：

```ts
class Service {
  readonly diagnostics = new DiagnosticRecorder({ source: 'demo' })

  @diagnostic('demo/load')
  async load() {
    return fetch('/items')
  }
}
```

Vite/Vitest/pack 均通过 `@swc/core` 的 TypeScript parser 和 `decoratorVersion:
'2023-11'` 转换装饰器语法。装饰器转换配置位于 both、client SDK 和 server 的 Vite
配置中，确保源码测试、声明构建和生产 bundle 使用相同语义。对象闭包、接口实现和
第三方回调没有 class method 装饰器边界时，继续使用 `withDiagnostic()`。

### 12.3 客户端 SDK

`@delta-comic/client` 位于 `packages/client/core/sdk`。每个插件由一个
`ClientRuntime` 持有，runtime 创建 `CordisRuntime`，注入 `client` service，再挂载
Cordis plugin 或 plugin set：

```ts
const runtime = new ClientRuntime({
  pluginId: 'demo.client',
  database,
})

await runtime.mount('demo', {
  inject: ['client'],
  apply(ctx) {
    ctx.client.store.set('ready', true)
    ctx.client.ui.registerRoute({
      path: '/plugins/demo.client/home',
      title: 'Demo',
      navigation: true,
    })
  },
})
```

`ClientHost` 暴露 typed `db`、`store` 和 `ui`。数据库查询通过
`ClientDatabase.query<Result>()`，store 通过泛型 `get/set`，所有宿主边界操作自动接入
诊断记录。UI 注册函数返回 disposer，随 Cordis fiber 卸载。`runtime.snapshot()` 返回
统一快照，`unmount()` 和 `dispose()` 释放插件及其作用域。

### 12.4 服务端 SDK

当前 `@delta-comic/server` 由已有 `packages/server` 承载，以兼容现有 Worker 入口；SDK
入口通过包根、`@delta-comic/server/manifest` 和 `@delta-comic/server/runtime` 暴露。
每个安装实例由独立 `ServerRuntime` 创建，注入 `server` service：

```ts
const runtime = new ServerRuntime({
  pluginId: 'demo.server',
  installationId: 'installation-1',
  db,
  identity,
})

await runtime.mount('demo', {
  inject: ['server'],
  apply(ctx) {
    ctx.server.registerRoute({
      method: 'GET',
      path: '/plugins/demo.server/health',
      public: true,
      handler: ({ request }, db) => new Response('ok'),
    })
    ctx.server.registerCron('*/5 * * * *', async context => {})
    ctx.server.registerQueue('refresh', async context => {})
    ctx.server.registerMigration({ id: '001-init', up: async db => {} })
  },
})
```

`dispatch()` 按 method/path 查找路由，并在 handler 前执行公开性和 permission 检查：
缺路由返回 404，缺少身份返回 401，缺少权限返回 403。`runCron()`、`runQueue()` 和
`migrate()` 都由 runtime 统一记录诊断；migration 按注册顺序执行，失败会保留失败记录
并停止当前迁移流程。D1 绑定、会话身份和 WfP 动态 dispatch 由后续平台 Worker 适配层
注入，SDK 不持有平台全局状态。

### 12.5 Manifest、权限和隔离边界

- 客户端 Manifest 使用 `platforms: ['desktop' | 'android']` 与客户端路由扩展。
- 服务端 Manifest 使用 typed routes、crons、queues 和 migration 声明。
- Manifest dependencies 负责安装期校验；运行时激活顺序由 Cordis `inject` 和 Service
  可用性决定。
- 客户端插件在可信 Tauri 进程内运行；服务端插件通过安装实例、Worker 和 D1 边界隔离。
- 服务端身份由宿主验证并注入，插件 handler 只读取 `ServerRequestContext.identity`。
- 资源 integrity 是 artifact 完整性校验，不等同于发布者签名；签名策略仍属于后续发布层。

### 12.6 阶段 40A 验证矩阵

| 层级 | 验证 |
|---|---|
| 公共协议 | both typecheck、artifact/diagnostic/runtime 专项测试 |
| 客户端 | client typecheck/build、Cordis injection、DB/store 诊断测试 |
| 服务端 | server app/node typecheck/build、route/cron/queue/migration 测试 |
| 装饰器 | SWC 转换后的 both/client/server 测试与 pack bundle |
| 全仓 | `vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run` |

阶段 40A 的交付边界到此为止；完整能力迁移按第 10、11 章的 package family、Rust
specta 生成链、Tauri 宿主和 Cloudflare 平台适配继续拆分提交。

---

## 第 1 章：目标、非目标与架构不变量

### 1.1 目标

1. **统一插件框架**：客户端与服务端使用同一套 Cordis 生命周期模型
2. **类型安全**：端到端类型覆盖（Rust → TS，Manifest → 运行时）
3. **AI 调试友好**：结构化日志、运行时快照、事件记录/回放
4. **最小侵入**：复用现有下载器、布局系统、UI 组件库
5. **前沿技术**：Vue RC + Vapor、最新依赖、不考虑向后兼容

### 1.2 非目标

- ❌ 客户端沙箱隔离（用户主动安装，完全可信）
- ❌ 插件市场审核机制（当前阶段）
- ❌ iOS 支持（只支持 Android 移动端）
- ❌ 保持旧插件兼容性（允许破坏性变更）

### 1.3 架构不变量

1. **单一类型源**：Rust 定义一次（specta），自动生成 TS/JSON Schema
2. **Cordis-first**：插件加载、依赖解析、生命周期由 Cordis 管理
3. **文件职责单一**：避免单文件超 300 行或包含多个不相关职责
4. **优先使用成熟库**：不造轮子（日志/ORM/HTTP 客户端等）
5. **ORM 优先**：默认使用 Kysely，避免手写 SQL

---

## 第 2 章：总体运行时拓扑与信任边界

### 2.1 运行时拓扑图

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端 (Tauri)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cordis Root Context + Registry                      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │ 内置插件    │  │ 内置插件    │  │ 外部插件    │    │  │
│  │  │ (源码集成) │  │ (源码集成) │  │ (blob URL) │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  │         ↓ Service API / Typed Events                │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │ 宿主服务层 (DB/UI/Layout/Player/Network)     │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                    ↓ Tauri IPC (specta 类型生成)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Rust Backend (文件/网络/原生能力)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│               服务端 (Cloudflare Workers)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  平台 Worker (主入口)                                 │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Workers for Platforms Dynamic Dispatch        │ │  │
│  │  │  ┌──────────────┐  ┌──────────────┐           │ │  │
│  │  │  │ 用户 A 插件 1 │  │ 用户 B 插件 2 │ ...      │ │  │
│  │  │  │ Worker       │  │ Worker       │           │ │  │
│  │  │  │ + Cordis     │  │ + Cordis     │           │ │  │
│  │  │  │ + D1         │  │ + D1         │           │ │  │
│  │  │  └──────────────┘  └──────────────┘           │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │  平台 D1 (auth/sync/admin)                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 信任边界

| 边界 | 客户端 | 服务端 |
|------|--------|--------|
| **插件可信度** | 完全可信 | 运行期不可信 |
| **隔离机制** | 无隔离（共享进程/内存） | Worker 隔离 + CPU/内存/subrequest 配额 |
| **数据访问** | 全量本地 DB/store | 独立 D1，与平台 DB 隔离 |
| **网络访问** | 无限制（经 Tauri 桥接） | 任意公网出站（经 Worker fetch） |
| **身份注入** | 无需（本地单用户） | 平台验证会话后注入 userId/installationId/permissions |
| **失败影响** | 插件 failed，宿主继续 | 当前实例 failed，其他实例/平台继续 |

### 2.3 关键设计决策

1. **客户端无沙箱理由**：
   - Tauri WebView 已在用户本地机器运行，恶意插件可通过 Tauri API 访问文件系统
   - 沙箱成本高（性能/复杂度），收益低（用户主动安装插件）
   - 诊断/调试需要完整系统可见性，沙箱会阻碍 AI 调试

2. **服务端 WfP 隔离理由**：
   - 多租户环境，一个用户的插件不能影响其他用户
   - 动态 dispatch 到独立 Worker，CPU/内存/subrequest 限制由 Cloudflare 平台强制
   - 每实例独立 D1，SQL 注入/误操作不影响平台数据

3. **两端 Cordis 统一理由**：
   - 插件生命周期模型一致，降低第三方开发者学习成本
   - Service/Events 抽象统一，宿主能力边界清晰
   - 诊断工具/事件回放/Loader 逻辑可复用

### 2.4 类型系统与 specta

**specta 是整个架构的类型基础设施**，不只是 Tauri IPC 工具，而是实现"单一类型源派生多端类型"的核心。

#### 单一类型源派生策略

| 类型源 | 派生目标 | 用途 |
|--------|---------|------|
| Rust struct/enum | TypeScript | 前端类型、Tauri IPC、Worker 类型 |
| Rust struct/enum | JSON Schema | Manifest 校验、配置校验 |
| Rust struct/enum | OpenAPI | 服务端 API 文档（可选） |
| 共享模型定义 | 多端类型 | 客户端/服务端/admin 统一模型 |

#### 具体应用场景

1. **Tauri IPC 类型安全**：
   ```rust
   #[derive(specta::Type, Serialize, Deserialize)]
   struct PluginConfig { /* ... */ }
   
   #[tauri::command]
   #[specta::specta]
   fn get_plugin_config(id: String) -> PluginConfig
   // → 自动生成 TS 类型，前端 invoke 端到端类型检查
   ```

2. **跨端模型统一**（客户端 Rust ↔ 前端 TS ↔ 服务端 Worker）：
   ```rust
   #[derive(specta::Type)]
   struct PluginManifest { /* ... */ }
   // → 生成 TS 定义供前端/Worker/admin 使用
   ```

3. **Manifest/配置校验**：
   ```rust
   #[derive(specta::Type)]
   struct ServerPluginManifest { /* ... */ }
   // → 生成 JSON Schema 用于安装时校验
   ```

#### 收益

- **消除跨边界运行时类型错误**：一次定义，多端使用，编译期保证一致性
- **降低维护成本**：避免手动同步 Rust/TS/JSON Schema，减少人工错误
- **提升 AI 调试友好度**：类型错误在编译期暴露，运行时日志不含类型不匹配噪声

---

## 第 3 章：Capability-family workspace 与包职责/发布面

### 3.1 Workspace 结构

参考 deepseek-harness 的按 capability family 分组策略，Delta Comic 采用三层结构：

```
packages/
├── client/                    # 客户端 capability families
│   ├── core/
│   │   ├── sdk/              → @delta-comic/client (公开)
│   │   ├── runtime/          → 客户端 Cordis runtime 封装
│   │   └── diagnostics/      → 诊断/快照/事件记录
│   ├── ui/
│   │   ├── components/       → 基础 UI 组件
│   │   ├── layout/           → 内容布局系统（迁移自 layout 仓库）
│   │   └── player/           → 播放器（图片/视频）
│   ├── data/
│   │   ├── db/               → 客户端数据库封装
│   │   ├── store/            → 状态管理
│   │   └── sync/             → 云同步客户端
│   └── platform/
│       ├── tauri/            → Tauri 桥接与 IPC
│       ├── network/          → 网络插件（内化 better-cors-fetch）
│       └── downloader/       → 下载管理器
├── server/                    # 服务端 capability families
│   ├── core/
│   │   ├── sdk/              → @delta-comic/server (公开)
│   │   ├── runtime/          → Worker Cordis runtime 封装
│   │   └── platform/         → WfP dispatch 与绑定注入
│   ├── services/
│   │   ├── auth/             → 认证/会话
│   │   ├── sync/             → 云同步服务端
│   │   └── plugins/          → 插件安装/管理
│   └── admin/                → 管理后台独立应用
└── shared/                    # 跨端共享
    ├── both/                 → @delta-comic/both (公开)
    ├── model/                → 数据模型（specta 类型源）
    └── utils/                → 通用工具

apps/
├── desktop/                  → Tauri 桌面应用（原 packages/app）
└── mobile/                   → Tauri Android 应用
```

### 3.2 公开发布包

| 包名 | 路径 | 职责 | 依赖 |
|------|------|------|------|
| `@delta-comic/both` | `packages/shared/both` | Cordis API、Manifest schema、ID/诊断协议 | `cordis` (re-export) |
| `@delta-comic/client` | `packages/client/core/sdk` | 客户端插件 SDK、扩展点 API、UI/layout/player/model 导出 | `@delta-comic/both` |
| `@delta-comic/server` | `packages/server/core/sdk` | 服务端插件 SDK、Worker 服务 API | `@delta-comic/both` |

### 3.3 包职责边界

#### `@delta-comic/both`

**导出内容**：
- Cordis 核心 API：`Context`、`Service`、`Events`、`Fiber`、`Registry`、`Loader`（统一 re-export，版本锁定）
- Manifest schema：`ClientPluginManifest`、`ServerPluginManifest`、共享字段定义
- 共享协议：`PluginId`、`InstallationId`、`DiagnosticSnapshot`、`protocolVersion`

**不包含**：
- 任何平台特定实现（Tauri API、Worker bindings）
- UI 组件、数据库、网络请求
- 内置插件或宿主服务

#### `@delta-comic/client`

**顶层导出**（从 `@delta-comic/both` re-export）：
- Cordis API：`Context`、`Service`、`Events` 等
- 核心类型：`ClientPluginManifest`、`PluginId`

**子路径导出**：
- `@delta-comic/client/ui`：基础组件、主题、工具函数
- `@delta-comic/client/layout`：布局系统（`ContentImagePage`、`ContentVideoPage` 等）
- `@delta-comic/client/player`：播放器组件与配置（`Artplayer`、`VideoConfig`）
- `@delta-comic/client/model`：数据模型（`Content`、`UniUser`、`Remote` 等，从 specta 生成）
- `@delta-comic/client/network`：网络服务（内化的 better-cors-fetch）

**服务 API**：
- 数据库/store 直接访问：`useDB()`、`useStore()` 等 typed API，每次调用接入诊断链
- 扩展点注册：`registerRoute()`、`registerNavItem()`、`registerCommand()` 等

#### `@delta-comic/server`

**顶层导出**（从 `@delta-comic/both` re-export）：
- Cordis API
- 核心类型：`ServerPluginManifest`

**服务 API**：
- 路由注册：`registerRoute(method, path, handler)`，handler 类型安全
- 定时任务：`registerCron(schedule, handler)`
- 队列/后台任务：`registerQueue(name, handler)`
- D1 访问：注入的 `env.DB`，插件直接 SQL 权限

### 3.4 内置插件与外部插件

| 类型 | 源码位置 | 构建方式 | 加载方式 |
|------|---------|---------|---------|
| 内置插件 | `packages/client/*/builtins/*.builtin.ts` | 参与宿主 Vite 构建 | 源码直接导入 |
| 外部插件 | 用户提供 artifact（ZIP/目录） | 第三方构建（vite/rollup） | Blob URL + dynamic import |

**统一合约**：
- 两者都遵循相同的 Manifest schema、Loader 协议、Cordis 生命周期
- 内置插件在 `composition.ts` 中静态注册，外部插件通过 `PluginArchiveRepository` 动态加载
- 布局/播放器迁入后成为内置能力，外部内容插件通过 `@delta-comic/client/layout` 等导出使用

### 3.5 依赖外部化与全局模块注册

**构建期**：
- 外部插件 bundle 配置 `external: ['@delta-comic/client', '@delta-comic/server', 'vue', 'naive-ui']`
- 内置插件无需 external（直接参与宿主构建）

**运行期**：
- 宿主在 `window['@delta-comic/client']` 等全局对象注册 SDK 模块
- 插件 `import('@delta-comic/client')` 通过 Blob URL import 时，浏览器解析为宿主提供的全局模块
- 客户端 Loader 在加载前确保全局模块已注册；服务端 Worker runtime 在启动时注入

---

## 第 4 章：Cordis、Loader 与 Manifest 协议

### 4.1 Cordis 集成策略

#### 上游依赖方式
- 使用 **Cordis 上游发布包**（npm `cordis`），不 vendoring
- `@delta-comic/both` 统一 re-export Cordis API，锁定版本
- 三个公开包（`both`/`client`/`server`）依赖同一个 Cordis 版本，`pnpm-workspace.yaml` 统一约束

#### 暴露的 Cordis API

`@delta-comic/both` 顶层导出：
```typescript
export {
  Context,
  Service,
  Events,
  Fiber,
  Registry,
  // Plugin types
  type Plugin,
  type PluginFunction,
  type PluginObject,
} from 'cordis'
```

### 4.2 Loader 与插件加载（基于 Cordis）

#### Cordis-first 原则

**Delta Comic Loader 的职责**：
- 从 artifact 读取代码（Blob URL/Worker bundle）
- 解析 Manifest 元数据（`protocolVersion`、`apiVersion`、`cordisVersion` 校验）
- 将插件模块交给 Cordis Registry

**Cordis 自动处理**：
- ✅ 读取插件的 `export const inject`
- ✅ 依赖解析与激活顺序
- ✅ 循环依赖检测
- ✅ 插件卸载时的逆序清理
- ✅ Service 生命周期管理

#### 客户端 Loader 流程

```typescript
// 1. 宿主创建 Cordis root context
const rootContext = new Context()

// 2. 注册宿主服务（DB/UI/Layout/Player/Network 等）
rootContext.plugin(DBService)
rootContext.plugin(UIService)
rootContext.plugin(LayoutService)
rootContext.plugin(NetworkService)

// 3. Delta Comic Loader 读取已安装插件
const archives = await pluginRepository.listInstalled()

for (const archive of archives) {
  // 4. 加载插件模块
  const moduleUrl = await fileStore.createModuleUrl(archive.pluginName, 'index.js')
  const module = await import(/* @vite-ignore */ moduleUrl)
  
  // 5. 交给 Cordis Registry 注册
  rootContext.plugin(module.default, archive.config)
  // Cordis 处理 inject、依赖、激活顺序
}

// 6. Cordis 自动处理依赖图和激活
await rootContext.start()
```

#### 服务端 Loader 流程

```typescript
// Worker 入口
export default {
  async fetch(request: Request, env: Env) {
    // 1. 创建 Cordis context
    const cordisCtx = new Context()
    
    // 2. 注入平台服务
    cordisCtx.plugin(D1Service, { db: env.DB })
    cordisCtx.plugin(AuthService, { session: request.session })
    
    // 3. 加载插件（从 D1/R2 读取 bundle）
    const pluginBundle = await loadPluginBundle(env, installationId)
    const pluginModule = await import(/* @vite-ignore */ pluginBundle.url)
    cordisCtx.plugin(pluginModule.default, pluginBundle.config)
    
    // 4. 启动 & 处理请求
    await cordisCtx.start()
    return handleRequest(request, cordisCtx)
  }
}
```

### 4.3 插件间依赖（基于 Cordis Context）

#### 服务提供方

```typescript
import { Context, Service } from '@delta-comic/client'

// TypeScript Module Augmentation
declare module '@delta-comic/client' {
  interface Context {
    contentProvider: ContentProviderService
  }
}

class ContentProviderService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'contentProvider', true) // immediate = true
  }
  
  async search(keyword: string): Promise<Content[]> { /* ... */ }
}

export default function ContentSourcePlugin(ctx: Context, config: any) {
  ctx.plugin(ContentProviderService)
}
```

#### 服务消费方

```typescript
import { Context } from '@delta-comic/client'

// Cordis inject 声明
export const inject = ['contentProvider']

export default function UIEnhancementPlugin(ctx: Context) {
  // TypeScript 知道 ctx.contentProvider 存在且类型安全
  ctx.on('search:submit', async (keyword) => {
    const results = await ctx.contentProvider.search(keyword)
    // ...
  })
}
```

**关键点**：
- 插件 B 不 `import` 插件 A 的具体实现，只依赖 Context 类型扩展
- 解耦插件实现，只耦合服务协议（Context interface）
- Cordis 运行时动态检查服务可用性，编译期 TypeScript 检查类型安全

### 4.4 Manifest Schema

#### 共享字段（`@delta-comic/both`）

```typescript
interface BasePluginManifest {
  protocolVersion: string        // 如 "1.0"
  pluginId: string               // 唯一标识
  version: string                // semver
  name: string
  description?: string
  author?: string
  
  cordisVersion: string          // 兼容的 Cordis 版本范围（semver）
  apiVersion: string             // 兼容的 Delta Comic API 版本
  
  entry: string                  // 入口文件路径（如 "index.js"）
  entryType: 'plugin' | 'plugin-set'
  
  resources?: ResourceManifest[] // 附加资源（动态 chunk、图片等）
  dependencies?: Record<string, string> // 插件依赖（pluginId → version）
  // dependencies 用于安装时校验，运行时由 Cordis inject 决定加载顺序
}

interface ResourceManifest {
  path: string
  mimeType: string
  integrity: string              // SRI hash
  imports?: string[]             // 该资源引用的其他资源路径
  platform?: 'client' | 'server' // 可选平台限定
}
```

#### 客户端扩展字段

```typescript
interface ClientPluginManifest extends BasePluginManifest {
  ui?: {
    routes?: RouteDeclaration[]
    navItems?: NavItemDeclaration[]
    commands?: CommandDeclaration[]
    homeCards?: HomeCardDeclaration[]
  }
}
```

#### 服务端扩展字段

```typescript
interface ServerPluginManifest extends BasePluginManifest {
  routes?: ServerRouteDeclaration[]
  cron?: CronDeclaration[]
  queues?: QueueDeclaration[]
  
  limits?: {
    cpu?: number                 // CPU 毫秒/请求
    memory?: number              // MB
    subrequests?: number         // 每请求出站请求数
  }
}
```

### 4.5 模块解析协议

#### 全局模块注册（客户端）

```typescript
// 宿主启动时
window['@delta-comic/client'] = {
  ...require('cordis'),          // Cordis API
  ...clientSDK,                  // Delta Comic 扩展
  ui: uiExports,
  layout: layoutExports,
  player: playerExports,
  model: modelExports,
  network: networkExports,
}

window['vue'] = require('vue')
window['naive-ui'] = require('naive-ui')
```

#### 插件 import 解析

插件构建时 externalize：
```javascript
// rollup.config.js
export default {
  external: ['@delta-comic/client', 'vue', 'naive-ui']
}
```

运行时 Blob URL 加载时，浏览器将 `import('@delta-comic/client')` 解析为 `window['@delta-comic/client']`。

### 4.6 Manifest 校验

使用 **specta 生成的 JSON Schema** 校验：

```rust
#[derive(specta::Type, Serialize, Deserialize)]
struct ClientPluginManifest { /* ... */ }

// 构建时生成 JSON Schema
let schema = specta::export::json_schema::<ClientPluginManifest>();
```

前端/Worker 使用生成的 schema 校验：
```typescript
import { validateManifest } from '@delta-comic/client/validation'
const result = validateManifest(manifestJson, 'client')
if (!result.valid) throw new Error(result.errors)
```

---

*（第 5-11 章内容继续...）*


## 第 5 章：客户端 SDK、扩展点与 Tauri 宿主

### 5.1 客户端 SDK 导出结构

#### `@delta-comic/client` 顶层导出

```typescript
// 从 @delta-comic/both re-export Cordis API
export {
  Context,
  Service,
  Events,
  Fiber,
  Registry,
  type Plugin,
  type PluginFunction,
  type PluginObject,
} from '@delta-comic/both'

// 核心类型
export type { ClientPluginManifest, PluginId, InstallationId } from '@delta-comic/both'

// 服务 API
export { useDB, useStore, useDiagnostics } from './services'

// 扩展点注册 API
export { registerRoute, registerNavItem, registerCommand, registerHomeCard } from './extensions'
```

#### 子路径导出

```typescript
// @delta-comic/client/ui
export { DCButton, DCInput, DCModal, DCTable, /* ... */ } from './ui/components'
export { theme, useTheme } from './ui/theme'

// @delta-comic/client/layout
export { ContentImagePage, ContentVideoPage, ContentListPage } from './layout'
export type { LayoutConfig, PageTransition } from './layout/types'

// @delta-comic/client/player
export { VideoPlayer, ImageViewer } from './player'
export type { VideoConfig, ImageConfig } from './player/types'

// @delta-comic/client/model
export type { Content, Chapter, UniUser, Remote, Subscription } from './model'

// @delta-comic/client/network
export { NetworkService } from './network'
export type { FetchOptions, FetchResponse } from './network/types'
```

### 5.2 扩展点 API

#### 路由注册

```typescript
ctx.registerRoute({
  path: '/my-plugin/search',
  component: MySearchPage,  // Vue 组件
  title: 'Search',
  icon: 'mdi:magnify',
})

// 运行时生成 Vue Router 路由
// 用户访问 /my-plugin/search 时渲染 MySearchPage
```

#### 导航项注册

```typescript
ctx.registerNavItem({
  label: 'My Section',
  icon: 'mdi:folder',
  route: '/my-plugin/search',
  order: 100,  // 显示顺序
})

// 在侧边栏/顶栏添加导航项
```

#### 命令注册

```typescript
ctx.registerCommand({
  id: 'my-plugin:refresh',
  label: 'Refresh Data',
  shortcut: 'Ctrl+R',
  handler: async () => {
    await ctx.myPlugin.refreshData()
  },
})

// 命令面板（Cmd+K）可搜索并执行
```

#### 首页卡片注册

```typescript
ctx.registerHomeCard({
  id: 'my-plugin:trending',
  title: 'Trending',
  component: TrendingCard,  // Vue 组件
  order: 50,
})

// 在首页显示自定义卡片
```

### 5.3 数据访问 API

#### 数据库访问（带诊断追踪）

```typescript
const db = ctx.useDB()

// 类型安全的 Kysely API
const items = await db
  .selectFrom('content')
  .where('status', '=', 'published')
  .selectAll()
  .execute()

// 每次查询自动记录到诊断系统
// - 插件 ID
// - 查询语句
// - 耗时
// - 结果行数
```

#### Store 访问

```typescript
const store = ctx.useStore()

// 响应式状态
const userSettings = store.get('user:settings')
store.set('user:settings', { theme: 'dark' })

// 持久化到本地（IndexedDB）
```

#### 插件自建表（可选）

插件可通过 Kysely 迁移自建表：

```typescript
export const migrations = [
  {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('my_plugin_cache')
        .addColumn('id', 'text', col => col.primaryKey())
        .addColumn('key', 'text', col => col.notNull().unique())
        .addColumn('value', 'text')
        .execute()
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('my_plugin_cache').execute()
    },
  },
]

export default function MyPlugin(ctx: Context) {
  // 启动时执行迁移
  ctx.on('start', async () => {
    const migrator = new Migrator({ db: ctx.useDB(), provider: { getMigrations: async () => migrations } })
    await migrator.migrateToLatest()
  })
}
```

### 5.4 Tauri 宿主集成

#### specta 类型生成

```rust
// apps/desktop/src-tauri/src/lib.rs
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

pub fn run() {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            db_query,
            fs_read_file,
            network_fetch,
            downloader_download,
        ])
        .path("../src/bindings.ts")  // 生成 TypeScript 绑定
        .export(Typescript::default())
        .expect("Failed to export typescript bindings");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_db::init())
        .plugin(tauri_plugin_network::init())
        .plugin(tauri_plugin_downloader::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

前端使用：
```typescript
import { invoke } from './bindings'  // specta 生成的类型安全绑定

// 端到端类型安全
const result = await invoke('db_query', { sql: 'SELECT * FROM content' })
//    ^? result: QueryResult（从 Rust 类型推导）
```

#### 宿主服务注册

```typescript
// apps/desktop/src/bootstrap.ts
import { Context } from '@delta-comic/client'
import { DBService, StoreService, DiagnosticsService, NetworkService } from '@delta-comic/client/services'

async function bootstrap() {
  // 1. 注册全局模块
  await registerGlobalModules()
  
  // 2. 创建 Cordis root context
  const rootContext = new Context()
  
  // 3. 注册宿主服务
  rootContext.plugin(DBService)
  rootContext.plugin(StoreService)
  rootContext.plugin(DiagnosticsService)
  rootContext.plugin(NetworkService)
  
  // 4. 加载内置插件
  rootContext.plugin(BuiltinLayout)
  rootContext.plugin(BuiltinPlayer)
  
  // 5. 加载外部插件
  const loader = new PluginLoader(rootContext)
  await loader.loadInstalled()
  
  // 6. 启动
  await rootContext.start()
  
  return rootContext
}
```

### 5.5 CSS 隔离策略

#### 主策略：作用域选择器 + CSS Modules

```vue
<!-- 插件组件 -->
<template>
  <div :class="$style.card">
    <h2 :class="$style.title">{{ title }}</h2>
  </div>
</template>

<style module>
.card {
  padding: 16px;
  background: var(--dc-bg-card);
}

.title {
  font-size: 18px;
  color: var(--dc-text-primary);
}
</style>
```

Vite 自动生成唯一类名：`.card_abc123`，避免全局污染。

#### 补充策略：Shadow DOM（复杂组件）

```typescript
// 对于需要完全隔离的复杂组件（如富文本编辑器）
export default defineComponent({
  setup() {
    const shadowRoot = ref<ShadowRoot>()
    
    onMounted(() => {
      const host = document.createElement('div')
      shadowRoot.value = host.attachShadow({ mode: 'open' })
      // 在 shadow root 内渲染组件
    })
  },
})
```

---

## 第 6 章：服务端 SDK、Worker runtime 与资源生命周期

### 6.1 服务端 SDK 导出结构

#### `@delta-comic/server` 顶层导出

```typescript
// 从 @delta-comic/both re-export Cordis API
export {
  Context,
  Service,
  Events,
  Fiber,
  Registry,
  type Plugin,
  type PluginFunction,
  type PluginObject,
} from '@delta-comic/both'

// 核心类型
export type { ServerPluginManifest, PluginId, InstallationId } from '@delta-comic/both'

// 服务端特有服务 API
export { useD1, useAuth, useQueue, useCron } from './services'
export { registerRoute, registerCron, registerQueue } from './extensions'
```

### 6.2 Workers for Platforms 动态 Dispatch

#### 平台 Worker 入口

```typescript
// packages/server/platform/dispatcher.ts
interface Env {
  PLUGIN_WORKERS: WorkersNamespace
  PLATFORM_DB: D1Database
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. 解析请求路径：/plugins/{installationId}/...
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/plugins\/([^\/]+)\/(.*)/)
    
    if (!match) {
      return new Response('Not found', { status: 404 })
    }
    
    const [, installationId, pluginPath] = match
    
    // 2. 验证会话（除非插件声明 public 路由）
    const session = await verifySession(request, env)
    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    // 3. 查询插件实例元数据
    const installation = await env.PLATFORM_DB
      .prepare('SELECT * FROM plugin_installations WHERE id = ? AND user_id = ?')
      .bind(installationId, session.userId)
      .first()
    
    if (!installation) {
      return new Response('Forbidden', { status: 403 })
    }
    
    // 4. 动态 dispatch 到插件 Worker
    const pluginWorker = env.PLUGIN_WORKERS.get(installationId)
    
    // 5. 注入身份上下文（不可伪造）
    const pluginRequest = new Request(request, {
      headers: {
        ...request.headers,
        'X-DC-User-Id': session.userId,
        'X-DC-Installation-Id': installationId,
        'X-DC-Permissions': JSON.stringify(installation.permissions),
      },
    })
    
    return pluginWorker.fetch(pluginRequest)
  }
}
```

#### 插件 Worker 入口

```typescript
// 插件构建产物入口
import { Context } from '@delta-comic/server'
import myPlugin from './index'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. 创建 Cordis context
    const cordisCtx = new Context()
    
    // 2. 注入平台服务
    cordisCtx.plugin(D1Service, { db: env.DB })  // 插件独立 D1
    cordisCtx.plugin(AuthService, {
      userId: request.headers.get('X-DC-User-Id')!,
      installationId: request.headers.get('X-DC-Installation-Id')!,
      permissions: JSON.parse(request.headers.get('X-DC-Permissions')!),
    })
    
    // 3. 注册插件
    cordisCtx.plugin(myPlugin, env.PLUGIN_CONFIG)
    
    // 4. 启动
    await cordisCtx.start()
    
    // 5. 路由处理
    return handleRequest(request, cordisCtx)
  }
}
```

### 6.3 路由注册与处理

#### Manifest 声明

```json
{
  "routes": [
    {
      "method": "GET",
      "path": "/api/my-endpoint",
      "public": false,
      "permissions": ["read:content"]
    },
    {
      "method": "POST",
      "path": "/webhook",
      "public": true
    }
  ]
}
```

#### 插件 Handler

```typescript
import { Context } from '@delta-comic/server'

export default function MyPlugin(ctx: Context) {
  ctx.registerRoute('GET', '/api/my-endpoint', async (request, auth) => {
    const db = ctx.useD1()
    
    const data = await db
      .selectFrom('my_plugin_table')
      .where('user_id', '=', auth.userId)
      .selectAll()
      .execute()
    
    return Response.json(data)
  })
  
  ctx.registerRoute('POST', '/webhook', async (request) => {
    const body = await request.json()
    // ...
    return Response.json({ ok: true })
  })
}
```

### 6.4 D1 生命周期与迁移

#### 插件安装时创建 D1

平台逻辑（伪代码）：
```typescript
async function installServerPlugin(userId: string, pluginId: string, manifest: ServerPluginManifest) {
  // 1. 创建独立 D1 数据库
  const dbName = `plugin_${userId}_${pluginId}_${nanoid()}`
  const db = await createD1Database(dbName)
  
  // 2. 执行初始迁移（如果 Manifest 声明）
  const migrations = manifest.migrations || []
  for (const migration of migrations) {
    await db.exec(migration.sql)
  }
  
  // 3. 记录安装实例
  const installationId = nanoid()
  await platformDB
    .insertInto('plugin_installations')
    .values({
      id: installationId,
      userId,
      pluginId,
      dbName,
      version: manifest.version,
      migrationVersion: migrations.length,
    })
    .execute()
  
  // 4. 创建 WfP Worker 绑定
  await bindWorker(installationId, { DB: db })
  
  return installationId
}
```

#### 插件启动时执行迁移

插件 Worker 启动逻辑：
```typescript
export default {
  async fetch(request: Request, env: Env) {
    const db = new Kysely({ dialect: new D1Dialect({ database: env.DB }) })
    
    // 1. 执行 Kysely 迁移
    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({ migrations }),
    })
    
    const { error } = await migrator.migrateToLatest()
    if (error) {
      console.error('Migration failed:', error)
      return new Response('Migration failed', { status: 500 })
    }
    
    // 2. 迁移成功，正常启动 Cordis
    const ctx = new Context()
    // ...
  }
}
```

### 6.5 定时任务与队列

#### Cron 注册

Manifest 声明：
```json
{
  "cron": [
    {
      "schedule": "0 0 * * *",
      "handler": "dailySync"
    }
  ]
}
```

插件代码：
```typescript
export const dailySync = async (ctx: Context) => {
  const db = ctx.useD1()
  // 执行定时任务
}

export default function MyPlugin(ctx: Context) {
  ctx.registerCron('0 0 * * *', dailySync)
}
```

平台通过 Cloudflare Cron Triggers 调度，传入身份上下文。

#### 队列注册

```typescript
ctx.registerQueue('process-item', async (batch, ctx) => {
  for (const message of batch.messages) {
    const item = message.body
    // 处理
  }
})
```

### 6.6 资源配额与限制

#### Manifest 声明

```json
{
  "limits": {
    "cpu": 50,
    "memory": 128,
    "subrequests": 10
  }
}
```

平台在创建 WfP Worker 时应用这些限制（Cloudflare 平台原生支持）。

超限时：
- 当前请求/job 失败
- 产生诊断事件
- Worker 不会被终止（其他请求仍可处理）

---


## 第 5 章：客户端 SDK、扩展点与 Tauri 宿主

### 5.1 客户端 SDK 导出结构

#### `@delta-comic/client` 顶层导出

```typescript
// 从 @delta-comic/both re-export Cordis API
export {
  Context,
  Service,
  Events,
  Fiber,
  Registry,
  type Plugin,
  type PluginFunction,
  type PluginObject,
} from '@delta-comic/both'

// 核心类型
export type { ClientPluginManifest, PluginId, InstallationId } from '@delta-comic/both'

// 服务 API
export { useDB, useStore, useDiagnostics } from './services'

// 扩展点注册 API
export { registerRoute, registerNavItem, registerCommand, registerHomeCard } from './extensions'
```

#### 子路径导出

```typescript
// @delta-comic/client/ui
export { DCButton, DCInput, DCModal, DCTable } from './ui/components'
export { theme, useTheme } from './ui/theme'

// @delta-comic/client/layout
export { ContentImagePage, ContentVideoPage, ContentListPage } from './layout'
export type { LayoutConfig, PageTransition } from './layout/types'

// @delta-comic/client/player
export { VideoPlayer, ImageViewer } from './player'
export type { VideoConfig, ImageConfig } from './player/types'

// @delta-comic/client/model
export type { Content, Chapter, UniUser, Remote, Subscription } from './model'

// @delta-comic/client/network
export { NetworkService } from './network'
export type { FetchOptions, FetchResponse } from './network/types'
```

### 5.2 扩展点 API

#### 路由注册

```typescript
ctx.registerRoute({
  path: '/my-plugin/search',
  component: MySearchPage,
  title: 'Search',
  icon: 'mdi:magnify',
})
```

#### 导航项注册

```typescript
ctx.registerNavItem({
  label: 'My Section',
  icon: 'mdi:folder',
  route: '/my-plugin/search',
  order: 100,
})
```

#### 命令注册

```typescript
ctx.registerCommand({
  id: 'my-plugin:refresh',
  label: 'Refresh Data',
  shortcut: 'Ctrl+R',
  handler: async () => {
    await ctx.myPlugin.refreshData()
  },
})
```

#### 首页卡片注册

```typescript
ctx.registerHomeCard({
  id: 'my-plugin:trending',
  title: 'Trending',
  component: TrendingCard,
  order: 50,
})
```

### 5.3 数据访问 API

#### 数据库访问（带诊断追踪）

```typescript
const db = ctx.useDB()

const items = await db
  .selectFrom('content')
  .where('status', '=', 'published')
  .selectAll()
  .execute()

// 每次查询自动记录到诊断系统
```

#### Store 访问

```typescript
const store = ctx.useStore()

const userSettings = store.get('user:settings')
store.set('user:settings', { theme: 'dark' })
```

#### 插件自建表（可选）

```typescript
export const migrations = [
  {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('my_plugin_cache')
        .addColumn('id', 'text', col => col.primaryKey())
        .addColumn('key', 'text', col => col.notNull().unique())
        .addColumn('value', 'text')
        .execute()
    },
  },
]
```

### 5.4 Tauri 宿主集成

#### specta 类型生成

```rust
// apps/desktop/src-tauri/src/lib.rs
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

pub fn run() {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            db_query,
            fs_read_file,
            network_fetch,
        ])
        .path("../src/bindings.ts")
        .export(Typescript::default())
        .expect("Failed to export typescript bindings");
}
```

前端使用：
```typescript
import { invoke } from './bindings'

// 端到端类型安全
const result = await invoke('db_query', { sql: 'SELECT * FROM content' })
```

#### 宿主服务注册

```typescript
// apps/desktop/src/bootstrap.ts
async function bootstrap() {
  await registerGlobalModules()
  
  const rootContext = new Context()
  
  rootContext.plugin(DBService)
  rootContext.plugin(StoreService)
  rootContext.plugin(DiagnosticsService)
  rootContext.plugin(NetworkService)
  
  rootContext.plugin(BuiltinLayout)
  rootContext.plugin(BuiltinPlayer)
  
  const loader = new PluginLoader(rootContext)
  await loader.loadInstalled()
  
  await rootContext.start()
  return rootContext
}
```

### 5.5 CSS 隔离策略

#### 主策略：作用域选择器 + CSS Modules

```vue
<template>
  <div :class="$style.card">
    <h2 :class="$style.title">{{ title }}</h2>
  </div>
</template>

<style module>
.card {
  padding: 16px;
  background: var(--dc-bg-card);
}
</style>
```

Vite 自动生成唯一类名：`.card_abc123`。

#### 补充策略：Shadow DOM（复杂组件）

对于需要完全隔离的复杂组件（如富文本编辑器），使用 Shadow DOM。

---

## 第 6 章：服务端 SDK、Worker runtime 与资源生命周期

### 6.1 服务端 SDK 导出结构

```typescript
export {
  Context,
  Service,
  Events,
  type Plugin,
} from '@delta-comic/both'

export type { ServerPluginManifest } from '@delta-comic/both'

export { useD1, useAuth } from './services'
export { registerRoute, registerCron, registerQueue } from './extensions'
```

### 6.2 Workers for Platforms 动态 Dispatch

#### 平台 Worker 入口

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/plugins\/([^\/]+)\/(.*)/)
    
    if (!match) return new Response('Not found', { status: 404 })
    
    const [, installationId] = match
    
    const session = await verifySession(request, env)
    if (!session) return new Response('Unauthorized', { status: 401 })
    
    const installation = await getInstallation(env.PLATFORM_DB, installationId)
    if (!installation || installation.userId !== session.userId) {
      return new Response('Forbidden', { status: 403 })
    }
    
    const pluginWorker = env.PLUGIN_WORKERS.get(installationId)
    
    const pluginRequest = new Request(request, {
      headers: {
        ...request.headers,
        'X-DC-User-Id': session.userId,
        'X-DC-Installation-Id': installationId,
        'X-DC-Permissions': JSON.stringify(installation.permissions),
      },
    })
    
    return pluginWorker.fetch(pluginRequest)
  }
}
```

#### 插件 Worker 入口

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const cordisCtx = new Context()
    
    cordisCtx.plugin(D1Service, { db: env.DB })
    cordisCtx.plugin(AuthService, {
      userId: request.headers.get('X-DC-User-Id')!,
      installationId: request.headers.get('X-DC-Installation-Id')!,
    })
    
    cordisCtx.plugin(myPlugin, env.PLUGIN_CONFIG)
    
    await cordisCtx.start()
    
    return handleRequest(request, cordisCtx)
  }
}
```

### 6.3 路由注册与处理

Manifest 声明：
```json
{
  "routes": [
    {
      "method": "GET",
      "path": "/api/my-endpoint",
      "public": false
    }
  ]
}
```

插件 Handler：
```typescript
ctx.registerRoute('GET', '/api/my-endpoint', async (request, auth) => {
  const db = ctx.useD1()
  
  const data = await db
    .selectFrom('my_plugin_table')
    .where('user_id', '=', auth.userId)
    .selectAll()
    .execute()
  
  return Response.json(data)
})
```

### 6.4 D1 生命周期与迁移

#### 插件安装时创建 D1

```typescript
async function installServerPlugin(userId, pluginId, manifest) {
  const dbName = `plugin_${userId}_${pluginId}_${nanoid()}`
  const db = await createD1Database(dbName)
  
  const installationId = nanoid()
  await platformDB
    .insertInto('plugin_installations')
    .values({
      id: installationId,
      userId,
      pluginId,
      dbName,
      version: manifest.version,
    })
    .execute()
  
  await bindWorker(installationId, { DB: db })
  return installationId
}
```

#### 插件启动时执行迁移

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const db = new Kysely({ dialect: new D1Dialect({ database: env.DB }) })
    
    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({ migrations }),
    })
    
    const { error } = await migrator.migrateToLatest()
    if (error) {
      return new Response('Migration failed', { status: 500 })
    }
    
    const ctx = new Context()
    // ...
  }
}
```

### 6.5 定时任务与队列

Manifest 声明：
```json
{
  "cron": [{ "schedule": "0 0 * * *", "handler": "dailySync" }]
}
```

插件代码：
```typescript
ctx.registerCron('0 0 * * *', dailySync)

ctx.registerQueue('process-item', async (batch) => {
  // 处理队列消息
})
```

### 6.6 资源配额

Manifest 声明：
```json
{
  "limits": {
    "cpu": 50,
    "memory": 128,
    "subrequests": 10
  }
}
```

平台在创建 WfP Worker 时应用这些限制。超限时当前请求失败，Worker 继续运行。


## 第 7 章：Manifest、产物格式、安装/升级与模块解析

### 7.1 产物格式（Artifact）

#### ZIP 包结构

```
my-plugin.zip
├── manifest.json
├── index.js
├── index.css
├── chunk-a.js
├── chunk-b.js
├── assets/
│   ├── icon.png
│   └── logo.svg
└── README.md
```

#### Manifest 完整示例（客户端）

```json
{
  "protocolVersion": "1.0",
  "pluginId": "com.example.my-plugin",
  "version": "1.2.3",
  "name": "My Plugin",
  "description": "A demo plugin",
  "author": "Alice <alice@example.com>",
  
  "cordisVersion": "^4.0.0",
  "apiVersion": "^3.0.0",
  
  "entry": "index.js",
  "entryType": "plugin",
  
  "resources": [
    {
      "path": "index.js",
      "mimeType": "application/javascript",
      "integrity": "sha384-...",
      "imports": ["chunk-a.js"]
    },
    {
      "path": "index.css",
      "mimeType": "text/css",
      "integrity": "sha384-..."
    }
  ],
  
  "dependencies": {
    "com.example.base-plugin": "^1.0.0"
  },
  
  "ui": {
    "routes": [
      {
        "path": "/my-page",
        "component": "MyPage",
        "title": "My Page",
        "icon": "mdi:star"
      }
    ]
  }
}
```

### 7.2 安装流程

```typescript
async function installPlugin(source: string) {
  // 1. 获取 artifact（ZIP/目录/Git release）
  const artifact = await fetchArtifact(source)
  
  // 2. 解析 Manifest
  const manifestText = await artifact.readFile('manifest.json')
  const manifest = JSON.parse(manifestText)
  
  // 3. 校验 Manifest（specta 生成的 JSON Schema）
  const validation = validateManifest(manifest, 'client')
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors}`)
  }
  
  // 4. 兼容性检查
  if (!semver.satisfies(CORDIS_VERSION, manifest.cordisVersion)) {
    throw new Error(`Incompatible Cordis version`)
  }
  if (!semver.satisfies(API_VERSION, manifest.apiVersion)) {
    throw new Error(`Incompatible API version`)
  }
  
  // 5. 依赖检查
  for (const [depId, versionRange] of Object.entries(manifest.dependencies || {})) {
    const dep = await pluginRepository.findByPluginId(depId)
    if (!dep) {
      throw new Error(`Missing dependency: ${depId}`)
    }
    if (!semver.satisfies(dep.version, versionRange)) {
      throw new Error(`Dependency version mismatch: ${depId}`)
    }
  }
  
  // 6. 计算资源 integrity
  for (const resource of manifest.resources || []) {
    const content = await artifact.readFile(resource.path)
    const hash = await computeSHA384(content)
    if (hash !== resource.integrity) {
      throw new Error(`Integrity mismatch: ${resource.path}`)
    }
  }
  
  // 7. 存储到本地
  await fileStore.write(pluginName, 'manifest.json', manifestText)
  await fileStore.write(pluginName, 'index.js', await artifact.readFile(manifest.entry))
  // ...
  
  // 8. 记录到数据库
  await pluginRepository.insert({
    pluginName,
    pluginId: manifest.pluginId,
    version: manifest.version,
    installInput: source,
    loaderName: 'stored',
    enabled: true,
  })
  
  return pluginName
}
```

### 7.3 升级流程

#### 原子切换策略

```typescript
async function upgradePlugin(pluginName: string, newSource: string) {
  // 1. 安装新版本到临时位置
  const tempName = `${pluginName}.upgrade-${Date.now()}`
  await installPluginToTemp(tempName, newSource)
  
  // 2. 校验新版本可激活
  try {
    await validatePluginActivation(tempName)
  } catch (error) {
    await fileStore.deleteAll(tempName)
    throw new Error(`New version activation failed: ${error}`)
  }
  
  // 3. 原子切换
  const oldBackup = `${pluginName}.backup-${Date.now()}`
  await fileStore.rename(pluginName, oldBackup)
  await fileStore.rename(tempName, pluginName)
  
  // 4. 更新数据库记录
  await pluginRepository.update(pluginName, {
    version: newManifest.version,
    installInput: newSource,
  })
  
  // 5. 重载插件（Cordis 卸载旧版本、加载新版本）
  await pluginRuntime.reload(pluginName)
  
  // 6. 清理备份（可选延迟）
  setTimeout(() => fileStore.deleteAll(oldBackup), 60000)
}
```

失败回滚：
- 如果步骤 2 校验失败，临时文件已删除，原插件不受影响
- 如果步骤 5 重载失败，原子切换已完成但激活失败，插件进入 `failed` 状态

### 7.4 模块解析细节

#### 全局模块注册实现

```typescript
// apps/desktop/src/bootstrap.ts
async function registerGlobalModules() {
  window['@delta-comic/client'] = await import('@delta-comic/client')
  window['@delta-comic/both'] = await import('@delta-comic/both')
  
  window['vue'] = await import('vue')
  window['naive-ui'] = await import('naive-ui')
  
  const client = window['@delta-comic/client']
  client.ui = await import('@delta-comic/client/ui')
  client.layout = await import('@delta-comic/client/layout')
  client.player = await import('@delta-comic/client/player')
  client.model = await import('@delta-comic/client/model')
  client.network = await import('@delta-comic/client/network')
}
```

#### 插件 import 解析（Blob URL）

插件构建时 externalize：
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      external: [
        '@delta-comic/client',
        '@delta-comic/both',
        'vue',
        'naive-ui',
      ],
    },
  },
}
```

运行时加载：
```typescript
async createModuleUrl(pluginName: string, fileName: string): Promise<string> {
  const content = await this.read(pluginName, fileName)
  
  // 替换 import 语句为全局模块引用
  const transformed = transformImports(content)
  
  const blob = new Blob([transformed], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  
  this.urls.set(`${pluginName}/${fileName}`, url)
  return url
}
```

### 7.5 动态 Chunk 加载

插件使用动态 import：
```typescript
const module = await import('./chunk-a.js')
```

Manifest 声明 chunk 依赖：
```json
{
  "resources": [
    {
      "path": "index.js",
      "imports": ["chunk-a.js"]
    },
    {
      "path": "chunk-a.js",
      "integrity": "sha384-..."
    }
  ]
}
```

运行时：
- 宿主预先将所有 resources 存储到 `PluginFileStore`
- 插件 `import('./chunk-a.js')` 时，通过相同的 Blob URL 机制加载

---

## 第 8 章：安全、权限、资源配额、隐私与故障隔离

### 8.1 客户端安全边界

#### 信任模型
- **完全可信**：用户主动安装插件，插件可访问全部本地数据
- **无沙箱隔离**：插件运行在同一 WebView 进程，共享内存
- **安全重点**：防止意外错误（非恶意攻击），隔离插件失败不影响宿主

#### 故障隔离

```typescript
class PluginScope {
  async safeCall<T>(fn: () => Promise<T>, context: string): Promise<T | undefined> {
    try {
      return await fn()
    } catch (error) {
      diagnostics.logError({
        pluginId: this.pluginId,
        context,
        error,
        timestamp: Date.now(),
      })
      
      return undefined
    }
  }
}
```

插件失败处理：
- 错误被捕获并记录到诊断系统
- 插件状态设为 `failed`
- 宿主继续运行，其他插件不受影响

### 8.2 服务端安全边界

#### 多租户隔离

| 隔离层 | 机制 | 作用 |
|--------|------|------|
| Worker 隔离 | WfP dynamic dispatch | 每个安装实例独立 Worker，V8 isolate 隔离内存 |
| 数据库隔离 | 独立 D1 per installation | SQL 注入/误操作不影响平台或其他用户 |
| 网络隔离 | Worker subrequest 限制 | 防止 DDoS 或资源耗尽 |
| CPU/内存配额 | Cloudflare 平台限制 | 超限请求失败，不影响其他 Worker |

#### 身份注入（不可伪造）

```typescript
// 平台 Worker
async function dispatchToPlugin(request, installation) {
  const session = await verifySession(request, env)
  
  const pluginRequest = new Request(request, {
    headers: {
      ...request.headers,
      'X-DC-User-Id': session.userId,
      'X-DC-Installation-Id': installation.id,
      'X-DC-Permissions': JSON.stringify(installation.permissions),
    },
  })
  
  const pluginWorker = env.PLUGIN_WORKERS.get(installation.id)
  return pluginWorker.fetch(pluginRequest)
}
```

插件无法伪造 `X-DC-*` header，因为：
- 平台 Worker 是唯一入口
- 插件 Worker 只能被平台 Worker 调用（WfP 配置）

### 8.3 权限模型

#### 自动授权策略

插件权限由 Manifest 自动授权，无需用户逐项确认。

**理由**：
- 客户端插件完全可信，用户已主动安装
- 服务端插件隔离在独立 Worker + D1，影响范围有限
- 避免权限疲劳

#### 权限范围

客户端：
- 默认可访问全部本地 DB/store
- 默认可注册 UI 扩展点
- 默认可调用 Tauri IPC（文件/网络）

服务端：
- 默认可访问独立 D1（SQL 无限制）
- 默认可发起任意公网 HTTP 请求
- 默认可声明路由/cron/queue

### 8.4 资源配额

#### 服务端配额

```json
{
  "limits": {
    "cpu": 50,
    "memory": 128,
    "subrequests": 10
  }
}
```

平台在创建 WfP Worker 时应用这些限制。

超限行为：
- **CPU 超限**：请求被 Cloudflare 终止，返回 500
- **内存超限**：Worker 崩溃，请求失败
- **Subrequest 超限**：第 N+1 个 fetch 抛错

#### 客户端配额

客户端无强制配额（本地环境，资源充足）。

可选监控：插件 CPU/内存占用（通过浏览器 Performance API）。

### 8.5 隐私与诊断数据

#### 数据采集策略

**元数据（始终采集）**：
```typescript
interface DiagnosticEvent {
  pluginId: string
  installationId: string
  version: string
  timestamp: number
  event: 'activated' | 'deactivated' | 'error' | 'api-call'
  context: string
  duration?: number
  error?: { name, message, stack }
}
```

**Payload（默认脱敏）**：不记录事件参数和业务 payload，除非插件显式开启。

#### 数据存储

客户端：
- 内存保留最近 1000 条事件
- 本地持久化每插件最近 100 条事件摘要
- 不上传到服务端

服务端：
- 平台保存服务端插件诊断摘要（错误/超限事件）
- 不记录请求 body/响应内容

#### 诊断面板权限

插件可读取自身结构化日志/trace/错误，宿主日志脱敏引用暴露。

### 8.6 故障隔离总结

| 场景 | 客户端 | 服务端 |
|------|--------|--------|
| 插件崩溃 | 捕获错误，插件 failed，宿主继续 | Worker 崩溃，请求失败，其他实例继续 |
| 插件卡死 | 浏览器 tab 卡住（无超时机制） | Worker CPU 超限自动终止 |
| 插件泄漏内存 | 影响整个 tab | Worker 内存超限崩溃，不影响其他 Worker |
| 恶意插件 | 可读取全部本地数据（可信模型） | 隔离在独立 D1，无法访问平台或其他用户数据 |


## 第 9 章：AI diagnostics、结构化日志、snapshot 与事件回放

### 9.1 AI 调试友好设计目标

**核心原则**：
- 所有关键实体有稳定 ID（pluginId/installationId/serviceId/eventId/fiberId）
- 结构化日志，避免非结构化文本拼接
- 运行时状态可快照导出（插件树/服务注册表/事件监听/fiber 状态）
- 事件可记录/回放，支持确定性复现

### 9.2 结构化日志（基于成熟库）

#### 日志库选型

| 环境 | 库 | 理由 |
|------|---|------|
| 客户端 | **tslog v5** | TypeScript 原生、支持浏览器、JSON 结构化输出 |
| 服务端 | **pino** | 高性能（比 winston 快 1.9x）、JSON 结构化、Worker 环境轻量 |

#### 客户端日志配置

```typescript
// packages/client/core/diagnostics/logger.ts
import { Logger } from 'tslog'

export function createPluginLogger(pluginId: string) {
  return new Logger({
    name: pluginId,
    type: 'json',
    minLevel: 0,
    attachedTransports: [
      (logObj) => {
        memoryBuffer.push(logObj)
        if (memoryBuffer.length > 1000) {
          memoryBuffer.shift()
        }
        persistLog(logObj)
      },
    ],
  })
}

// 插件使用
const logger = ctx.useLogger()

logger.info('Content fetched', {
  contentId: item.id,
  title: item.title,
  duration: 250,
})
```

#### 服务端日志配置

```typescript
// packages/server/core/diagnostics/logger.ts
import pino from 'pino'

export function createPluginLogger(pluginId: string, installationId: string) {
  return pino({
    name: pluginId,
    level: 'info',
    formatters: {
      bindings: () => ({
        pluginId,
        installationId,
      }),
    },
  })
}

// 插件使用
const logger = ctx.useLogger()

logger.info({ contentId: item.id, duration: 250 }, 'Content fetched')
```

### 9.3 运行时状态快照

#### Snapshot Schema

```typescript
interface RuntimeSnapshot {
  timestamp: number
  platform: 'client' | 'server'
  
  plugins: PluginSnapshot[]
  services: ServiceSnapshot[]
  events: EventSnapshot[]
  fibers: FiberSnapshot[]
  
  dependencyGraph: DependencyGraph
  configSources: ConfigSource[]
}

interface PluginSnapshot {
  pluginId: string
  pluginName: string
  version: string
  state: 'pending' | 'active' | 'failed' | 'disabled'
  dependencies: string[]
  provides: string[]
  fiberId: string
  config: unknown
  errorSummary?: string
}
```

#### 导出快照

```typescript
const diagnostics = ctx.useDiagnostics()
const snapshot = await diagnostics.captureSnapshot()

await Tauri.fs.writeTextFile('snapshot.json', JSON.stringify(snapshot, null, 2))
```

### 9.4 事件记录与回放

#### 记录事件

```typescript
interface RecordedEvent {
  id: string
  timestamp: number
  event: string
  payload: unknown
  result?: unknown
  error?: string
  pluginId: string
  duration: number
}

class EventRecorder {
  startRecording() {
    ctx.on('**', (event, ...args) => {
      const record: RecordedEvent = {
        id: nanoid(),
        timestamp: Date.now(),
        event,
        payload: serializePayload(args),
        pluginId: getCurrentPlugin(),
      }
      this.recording.push(record)
    }, { priority: -1000 })
  }
}
```

#### 回放事件

```typescript
async function replayEvents(events: RecordedEvent[]) {
  await resetRuntime()
  
  for (const event of events) {
    await ctx.emit(event.event, ...deserializePayload(event.payload))
  }
}
```

### 9.5 诊断面板

#### 功能列表

| 功能 | 描述 |
|------|------|
| 插件列表 | 显示所有插件状态、版本、依赖 |
| 服务注册表 | 显示所有 Service、提供者、消费者 |
| 事件监听器 | 显示每个事件的监听插件、优先级、调用次数 |
| 日志查看器 | 过滤/搜索结构化日志，按插件/level/event 筛选 |
| 快照导出 | 一键导出当前运行时状态 JSON |
| 事件记录 | 开始/停止事件记录，导出/回放 |
| 依赖图可视化 | D3.js 渲染插件依赖关系图 |
| Fiber 状态 | 显示每个 Fiber 的 effect、disposal 状态 |

#### UI 实现

```vue
<template>
  <NTabs>
    <NTabPane name="plugins" label="插件">
      <PluginList :plugins="snapshot.plugins" />
    </NTabPane>
    <NTabPane name="services" label="服务">
      <ServiceRegistry :services="snapshot.services" />
    </NTabPane>
    <NTabPane name="logs" label="日志">
      <LogViewer :logs="logs" />
    </NTabPane>
  </NTabs>
</template>
```

### 9.6 最小运行时 Harness

```typescript
// packages/client/core/diagnostics/harness.ts
export async function createMinimalRuntime(options: {
  plugins: Array<{ module: Plugin, config: unknown }>
  mockServices?: Record<string, unknown>
}) {
  const ctx = new Context()
  
  for (const [serviceId, mock] of Object.entries(options.mockServices || {})) {
    ctx.provide(serviceId, mock)
  }
  
  for (const { module, config } of options.plugins) {
    ctx.plugin(module, config)
  }
  
  await ctx.start()
  return ctx
}
```

---

## 第 10 章：应用/server/admin 重组及数据模型

### 10.1 应用重组

#### 当前结构 → 目标结构

```
当前：
packages/app/              → 桌面 + Web 客户端混合

目标：
apps/desktop/              → Tauri 桌面应用（macOS/Windows/Linux）
apps/mobile/               → Tauri Android 应用
packages/server/           → Worker 服务端
packages/server-admin/     → 独立 Vue 管理后台应用
```

### 10.2 保留功能映射

#### 客户端功能

| 当前功能 | 目标位置 | 实现方式 |
|---------|---------|---------|
| 主页/搜索/订阅 | `apps/desktop/src/views/` | Vue 组件 + 宿主服务 |
| 用户收藏/历史 | 同上 | Cordis service API |
| 下载管理 | `packages/client/platform/downloader` | 复用现有下载器，修补接入 Cordis |
| 插件列表/市场 | `apps/desktop/src/views/Plugins.vue` | 插件管理 UI |
| 云同步 | `packages/client/data/sync` | 客户端同步服务 |

### 10.3 数据模型迁移（使用 Kysely ORM）

#### 客户端数据库

**保留表**：
- `content`、`chapter`、`user`、`subscription`、`history`、`favourite`、`download`
- `plugin_archive`、`plugin_config`

**新增表**（通过 Kysely Migrator）：

```typescript
// packages/client/data/db/migrations/001_plugin_diagnostics.ts
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('plugin_diagnostic_log')
    .addColumn('id', 'text', col => col.primaryKey())
    .addColumn('plugin_id', 'text', col => col.notNull())
    .addColumn('timestamp', 'integer', col => col.notNull())
    .addColumn('level', 'text', col => col.notNull())
    .addColumn('event', 'text', col => col.notNull())
    .addColumn('context', 'text')
    .addColumn('error', 'text')
    .addColumn('duration', 'integer')
    .execute()
}
```

**插件使用 Kysely**：

```typescript
const db = ctx.useDB()

const items = await db
  .selectFrom('content')
  .where('status', '=', 'published')
  .selectAll()
  .execute()

await db
  .insertInto('plugin_diagnostic_log')
  .values({
    id: nanoid(),
    plugin_id: ctx.self.pluginId,
    timestamp: Date.now(),
    level: 'info',
    event: 'content:fetched',
    context: JSON.stringify({ contentId: '123' }),
  })
  .execute()
```

#### 服务端数据库

**平台 D1**（通过 Kysely Migrator）：

```typescript
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', col => col.primaryKey())
    .addColumn('email', 'text', col => col.notNull().unique())
    .addColumn('password_hash', 'text', col => col.notNull())
    .addColumn('created_at', 'integer', col => col.notNull())
    .execute()
  
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'text', col => col.primaryKey())
    .addColumn('user_id', 'text', col => col.notNull().references('users.id'))
    .addColumn('token_hash', 'text', col => col.notNull())
    .addColumn('expires_at', 'integer', col => col.notNull())
    .execute()
}
```

**服务端 API 使用**：

```typescript
export async function login(email: string, password: string, db: Kysely<DB>) {
  const user = await db
    .selectFrom('users')
    .where('email', '=', email)
    .selectAll()
    .executeTakeFirst()
  
  if (!user || !await verifyPassword(password, user.password_hash)) {
    throw new Error('Invalid credentials')
  }
  
  const session = {
    id: nanoid(),
    user_id: user.id,
    token_hash: await hashToken(nanoid()),
    expires_at: Date.now() + 7 * 24 * 3600 * 1000,
  }
  
  await db.insertInto('sessions').values(session).execute()
  return session
}
```

### 10.4 下载器集成

**复用现有实现**：
- 保留 `packages/client/platform/downloader` 现有代码
- 修补接入 Cordis：

```typescript
import { Service, Context } from '@delta-comic/client'
import { existingDownloader } from './legacy'

export class DownloaderService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'downloader')
    this.delegate = existingDownloader
  }
  
  async download(url: string, options: DownloadOptions) {
    return this.delegate.download(url, options)
  }
}
```

### 10.5 移动端特殊考虑（Android only）

#### WebView 能力边界

Tauri Android 移动端：
- **WebView**：Chrome 内核（要求 Android 7+）
- **完整支持**：Vue 3 + Vite + ES2020+ + Cordis 插件

**能力对比**：

| 功能 | 桌面 | Android | 备注 |
|------|-----|---------|------|
| Vue 3 + Vite | ✅ | ✅ | 完全支持 |
| Cordis 插件 | ✅ | ✅ | JavaScript 运行环境一致 |
| Tauri IPC | ✅ | ✅ | specta 生成绑定统一 |
| 文件系统 | ✅ | 🟡 | Android 受沙箱限制，需适配 scoped storage |
| 下载器 | ✅ | 🟡 | Android 需适配平台下载 API |
| 通知 | ✅ | ✅ | Tauri 统一 API |

#### Android 适配

```typescript
export const isMobile = () => {
  return Tauri.os() === 'android'
}

if (isMobile()) {
  ctx.plugin(AndroidDownloaderService)
  ctx.plugin(AndroidStorageService)
} else {
  ctx.plugin(DesktopDownloaderService)
}
```

---

## 第 11 章：依赖升级、发布/版本协同与验证策略

### 11.1 依赖升级范围（前沿路线）

#### Workspace 依赖

| 类别 | 目标版本 | 策略 |
|------|---------|------|
| Vue | `^3.6.0-rc.x` 或 latest RC | 使用 RC 版本 + Vapor 模式 |
| Vite | `^6.x.x` 或 `next` | 最新稳定或 canary |
| Cordis | `^4.0.0` 或 latest | 上游最新版本 |
| specta | `^2.x.x` 或 latest | 最新版本 |
| Kysely | `^0.28.x` 或 latest | 最新版本 |
| tslog | `^5.x.x` | 最新稳定 |
| pino | `^9.x.x` | 最新稳定 |

#### Vue Vapor 模式启用

```typescript
// vite.config.ts
import vue from '@vitejs/plugin-vue'
import vapor from '@vitejs/plugin-vue-vapor'

export default defineConfig({
  plugins: [
    vue({
      compiler: {
        mode: 'vapor',
      },
    }),
    vapor(),
  ],
})
```

#### Tauri 性能优化

- **Custom Protocol 传输二进制数据**：图片/下载内容通过 `tauri://` 自定义协议传输，避免 JSON 序列化/base64 编码
- **树摇优化 + 代码分割**：Vite 默认支持，确保 `package.json` 正确配置 `sideEffects`，可减少 50-70% bundle 大小
- **Rust 二进制优化**：使用 `lld` 链接器加速构建，strip symbols、LTO 优化

### 11.2 公开包发布策略

#### 统一发布

三个公开包（`@delta-comic/both`、`@delta-comic/client`、`@delta-comic/server`）**统一版本号**，同时发布：

```bash
vp run set-ver -- 3.0.0
vp run publish --dry-run
vp run publish
```

#### apiVersion 协议

Manifest `apiVersion` 字段对应公开包版本：

```json
{
  "apiVersion": "^3.0.0"
}
```

运行时检查：
```typescript
if (!semver.satisfies(API_VERSION, manifest.apiVersion)) {
  throw new Error(`Incompatible API version`)
}
```

### 11.3 验证流程

#### 本地验证（pre-publish）

```bash
vp check --fix
vp run -r typecheck
vp test run
vp run lib-build
vp run codegen:specta
```

#### CI 验证（GitHub Actions）

```yaml
name: Publish
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: vp install --frozen-lockfile
      - run: vp run codegen:all
      - run: vp check
      - run: vp run -r typecheck
      - run: vp test run
      - run: vp run lib-build
      - run: vp run publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 11.4 兼容性保证

#### 插件 API 稳定性

**承诺**：
- Minor 版本内 API 向后兼容（3.0 插件可在 3.5 运行）
- Major 版本可破坏 API（3.x 插件不保证在 4.x 运行）

**废弃流程**：
1. 标记 API 为 `@deprecated`
2. 运行时警告（console.warn）
3. 等待至少 1 个 minor 版本
4. 下个 major 版本移除

#### Manifest 向前兼容

新 runtime 可加载旧 Manifest：忽略未知字段，提供合理默认值。

旧 runtime 拒绝新 Manifest：检查 `protocolVersion`，如果不兼容，安装时报错。

### 11.5 网络插件内化方案

#### 目标结构

```
packages/network/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── commands.rs
│   ├── client.rs
│   └── error.rs
├── guest-js/
│   ├── index.ts
│   └── package.json
└── permissions/
```

#### 内化步骤

1. Fork `tauri-plugin-better-cors-fetch` 仓库代码到 `packages/network`
2. 创建 Cargo.toml，添加 specta/tauri-specta features
3. 定制：specta 类型生成、Cordis 集成、诊断日志
4. 更新 workspace 依赖，移除 `tauri-plugin-better-cors-fetch`
5. 宿主注册 NetworkService

#### Cordis 集成

```typescript
import { Service, Context } from '@delta-comic/client'

export class NetworkService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'network')
  }
  
  async fetch(url: string, options: FetchOptions): Promise<FetchResponse> {
    const diagnostics = this.ctx.useDiagnostics()
    const start = Date.now()
    
    try {
      const response = await invoke<FetchResponse>('plugin:network|fetch', { url, options })
      
      diagnostics.log({
        level: 'info',
        source: { pluginId: 'delta-comic:network' },
        event: 'network:fetch',
        context: { url, method: options.method, status: response.status },
        duration: Date.now() - start,
      })
      
      return response
    } catch (error) {
      diagnostics.log({
        level: 'error',
        source: { pluginId: 'delta-comic:network' },
        event: 'network:fetch:error',
        context: { url },
        error: { name: 'FetchError', message: String(error), stack: '' },
        duration: Date.now() - start,
      })
      throw error
    }
  }
}
```

---

## 附录：实施路线图

### 阶段 1：基础设施（2 周）

- [ ] 创建 workspace 结构（packages/client、packages/server、packages/shared）
- [ ] 配置 specta + tauri-specta 类型生成
- [ ] 集成 Cordis（统一 re-export @delta-comic/both）
- [ ] 配置 Kysely + 迁移工具

### 阶段 2：客户端插件系统（3 周）

- [ ] 实现 PluginLoader（Blob URL + dynamic import）
- [ ] 实现宿主服务（DBService、StoreService、DiagnosticsService）
- [ ] 实现扩展点 API（registerRoute、registerNavItem 等）
- [ ] 迁移布局/播放器为内置插件
- [ ] 内化网络插件（packages/network）

### 阶段 3：服务端插件系统（3 周）

- [ ] 实现平台 Worker dispatcher
- [ ] 实现插件 Worker runtime（Cordis + D1Service + AuthService）
- [ ] 实现插件安装/D1 创建流程
- [ ] 实现 WfP dynamic dispatch
- [ ] 实现路由/cron/queue 注册

### 阶段 4：诊断与 AI 调试（2 周）

- [ ] 集成 tslog（客户端）+ pino（服务端）
- [ ] 实现运行时快照（PluginSnapshot/ServiceSnapshot/FiberSnapshot）
- [ ] 实现事件记录/回放
- [ ] 实现诊断面板 UI
- [ ] 实现最小运行时 harness

### 阶段 5：应用重组与数据迁移（2 周）

- [ ] 创建 apps/desktop（迁移 packages/app）
- [ ] 创建 apps/mobile（Android 适配）
- [ ] 数据库迁移（Kysely Migrator）
- [ ] 下载器接入 Cordis
- [ ] 管理后台独立化

### 阶段 6：测试与文档（1 周）

- [ ] 单元测试（各包 >75% 覆盖率）
- [ ] 集成测试（安装/升级/卸载流程）
- [ ] 性能测试（插件加载时间、事件响应延迟）
- [ ] 编写插件开发文档
- [ ] 编写部署文档

---

## 总结

Delta Comic 插件系统通过 **Cordis 统一生命周期**、**specta 单一类型源**、**Kysely ORM 数据访问**、**tslog/pino 结构化日志** 实现了跨端一致、类型安全、AI 友好的架构。

**核心亮点**：
1. 客户端/服务端统一插件模型（Cordis）
2. 端到端类型安全（specta 派生多端类型）
3. AI 调试友好（结构化日志、运行时快照、事件回放）
4. 最小侵入（复用现有下载器、布局、UI）
5. 前沿技术（Vue RC + Vapor、最新依赖）

**关键技术选型**：
- Tauri 2.x + specta 2.x + tauri-specta 2.x
- Cordis 4.x（统一客户端/服务端插件框架）
- Kysely 0.28.x（类型安全 ORM）
- tslog 5.x（客户端日志）+ pino 9.x（服务端日志）
- Vue 3.6 RC + Vapor（实验性编译模式）
- Cloudflare Workers + D1 + WfP（服务端运行时）
