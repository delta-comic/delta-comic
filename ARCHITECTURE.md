# Delta Comic 插件系统架构设计

> **版本**: 1.0.0  
> **状态**: 设计定稿  
> **日期**: 2026-09-26

## 摘要

Delta Comic 插件系统重构方案，采用 Cordis 作为统一的客户端/服务端插件框架，specta 作为类型基础设施，实现跨端一致的插件生命周期管理、类型安全的 API、AI 友好的诊断系统与最小侵入式的架构演进。

**核心技术栈**：
- 客户端：Tauri (桌面/Android) + Vue 3.6 RC (Vapor) + Cordis + Kysely
- 服务端：Cloudflare Workers (WfP) + D1 + Cordis + Kysely
- 类型系统：specta + tauri-specta（单一类型源派生多端类型）
- 日志：tslog (客户端) + pino (服务端)

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

