<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a CLI called `vp`. CI installs the global CLI through `voidzero-dev/setup-vp`; in Cloud Codex or other environments where global `vp` is unavailable, use the project-local CLI with `pnpm exec vp <command>` or the root package scripts (`pnpm run check`, `pnpm run test`, `pnpm run vp:install`). Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`. Run `pnpm exec vp help` to print a list of commands and `pnpm exec vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started; if global `vp` is unavailable, run `pnpm run vp:install` or `pnpm exec vp install`.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes; if global `vp` is unavailable, run `pnpm run check` and `pnpm run test`.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>` or `pnpm exec vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `pnpm exec vp config --help` and include the relevant output when asking for help.

<!--VITE PLUS END-->

# delta-comic 项目索引（AI 工作指南）

**注意改动后不要忘记更新该索引(AGENT.md)**

## 开发思想

- **模块**：使用文件系统分割模块来保证结构工整；对于按步骤流程运行不同模块的，或许可以使用glob引入执行实现由文件驱动模块
- **思想**：优先使用oop(面向对象)思想编写代码，但要避免过度封装，继承链最好不要超过5层。使用`依赖注入`思想优化耦合，但也要避免过度封装。最好遵守`dry`(不要重复自己)规则。
- **格式**：使用类似"条件反转"等技巧减少代码嵌套，但不要过度的不加分辨的使用

## 项目概览

**delta-comic** 是基于 **Tauri 2.x** 的跨平台漫画阅读应用，支持 Android 和桌面端。采用 **pnpm monorepo** 架构，以 **AGPL-3.0** 协议开源。

- **前端**：Vue 3 + TypeScript 6 + Vite + NaiveUI + Vant + Pinia + Vue Router
- **后端**：Rust (Tauri 2.x, edition 2024) + SQLite + Kysely ORM
- **云服务**：Elysia + Cloudflare Workers + Cloudflare Vite Plugin + Wrangler
- **数据库**：本地 SQLite，由 `tauri-plugin-sql` 提供 Rust 驱动，Kysely 做类型安全查询
- **插件系统**：分级可扩展架构，Rust 端提供命令 API，TS 端通过 Composition API 注入页面和功能
- **线上仓库**：<https://github.com/delta-comic/delta-comic.git>
- **依赖管理**：使用 pnpm catalog 统一管理所有依赖版本（见 `pnpm-workspace.yaml`）

---

## Workspace 包依赖关系（从底层到顶层）

### TypeScript 包依赖链

```
packages/model         ← 纯类型定义，无 workspace 依赖
  ↑
packages/utils         ← 通用工具，无 workspace 依赖
  ↑
packages/db            ← 依赖 model（同时是 Tauri 插件 crate: tauri-plugin-db）
packages/plugin        ← 依赖 model（同时是 Tauri 插件 crate: tauri-plugin-plugin）
  ↑
packages/ui            ← 依赖 model
  ↑
packages/app           ← 依赖所有包 + src-tauri（Rust 主应用，包含 @delta-comic/server 客户端接入）

packages/server-config ← Server 系列共享模块/运行时配置，无 workspace 依赖
packages/server        ← Cloudflare Worker 服务 + 客户端 SDK，依赖 server-config
packages/server-admin  ← Cloudflare Pages 管理面板，依赖 server/server-config/ui
```

### Rust Crate 依赖关系

```
packages/db (tauri-plugin-db)
  ↕  内嵌 tauri-plugin-sql
  ↕  暴露 native_store_* 命令
  ↓
packages/plugin (tauri-plugin-plugin)
  ↕  暴露 plugin:* 命令
  ↓
packages/app/src-tauri (delta_comic)
  ↕  依赖 tauri-plugin-db + tauri-plugin-plugin
  ↕  注册所有 Tauri 插件
```

---

## 各包详细说明

### 1. `packages/model` — 数据模型层（@delta-comic/model）

**职责**：定义整个项目共享的 TypeScript 类型、接口、枚举。最底层包，被几乎所有其他包依赖。

| 路径 | 说明 |
|------|------|
| `packages/model/lib/index.ts` | 总入口，以 `uni` 命名空间导出 model/，透传导出 struct/ |
| `packages/model/lib/model/index.ts` | model 总聚合，重新导出 9 个子模块 |
| `packages/model/lib/model/comment.ts` | 评论类型定义 |
| `packages/model/lib/model/content.ts` | 漫画内容数据结构 |
| `packages/model/lib/model/download.ts` | 下载任务类型定义 |
| `packages/model/lib/model/ep.ts` | 章节/EP 相关类型 |
| `packages/model/lib/model/image.ts` | 图片/封面相关类型 |
| `packages/model/lib/model/item.ts` | 条目/单元项类型 |
| `packages/model/lib/model/resource.ts` | 资源（图片/文件）类型 |
| `packages/model/lib/model/user.ts` | 用户相关类型 |
| `packages/model/lib/struct/index.ts` | struct 总聚合 |
| `packages/model/lib/struct/store.ts` | 通用存储结构（`SourcedValue`、`SourcedKeyMap`） |
| `packages/model/lib/struct/store.test.ts` | store 结构单元测试 |
| `packages/model/lib/struct/struct.ts` | 基础数据结构 |
| `packages/model/lib/struct/meta.ts` | 元数据相关结构 |
| `packages/model/lib/struct/from.ts` | 来源标记结构 |

---

### 2. `packages/utils` — 通用工具层（@delta-comic/utils）

**职责**：提供共享工具函数与 Tauri 工具插件，集成 Sentry（错误监控）、mitt（事件总线）、日志、本地 `local://` scheme、WebView 外链鉴权辅助命令。依赖 `naive-ui`、`pinia`、`vue-router`、`@vue/language-core`。

| 文件 | 说明 |
|------|------|
| `packages/utils/lib/index.ts` | 总入口，聚合导出 env/var/fullscreen/net/ipc/temp/webviewAuth |
| `packages/utils/lib/env.ts` | 环境检测（`isTauri`、`isMobile`、`isDesktop`、`getPlatform`） |
| `packages/utils/lib/var.ts` | 全局变量/常量 API |
| `packages/utils/lib/var.test.ts` | var 模块单元测试 |
| `packages/utils/lib/fullscreen.ts` | 全屏控制 |
| `packages/utils/lib/fullscreen.test.ts` | 全屏控制单元测试 |
| `packages/utils/lib/net.ts` | 网络请求工具 |
| `packages/utils/lib/net.test.ts` | 网络请求单元测试 |
| `packages/utils/lib/ipc.ts` | Tauri IPC 通信封装 |
| `packages/utils/lib/ipc.test.ts` | IPC 通信单元测试 |
| `packages/utils/lib/temp.ts` | 临时文件管理 |
| `packages/utils/lib/webviewAuth.ts` | WebView 外链鉴权 TS API：底层 command wrapper + `PageWebviewAuth`/`IframeWebviewAuth` 类封装（打开/关闭 page、注入代码、读取 cookie/storage/iframe 快照、等待回调并自动关闭） |
| `packages/utils/lib/test/setup.ts` | 测试环境 Memory DOM 模拟 |
| `packages/utils/vite/index.ts` | Vite 构建插件，定义 ExternalLib 映射 |
| `packages/utils/src/lib.rs` | `tauri-plugin-utils` 入口：注册日志、`local://` scheme、WebView auth commands |
| `packages/utils/src/commands/` | Rust command 分模块：page/storage/cookies/eval/scripts/types |
| `packages/utils/src/webview_registry.rs` | WebView label registry 与临时 auth page label 生成 |
| `packages/utils/src/mobile.rs` | Android mobile plugin bridge 注册 |
| `packages/utils/android/src/main/java/UtilsPlugin.kt` | Android Kotlin 插件：通过 `CookieManager` 读取 WebView cookie header |
| `packages/utils/permissions/` | `utils:default` 权限与自动生成的 command 权限 schema |

**Rust 端暴露的 WebView auth 命令**：

| 命令 | 功能 |
|------|------|
| `webview_open_page` | 打开临时 WebView page（支持外链 URL），注入 CSS/JS 和 all-frames auth bridge |
| `webview_inject_code` | 向当前或指定 page 注入 CSS/JS auth bridge |
| `webview_close_current_page` | 关闭当前 WebView page |
| `webview_close_page` | 关闭指定 label 的 WebView page |
| `webview_auth_data_current` | 获取当前 WebView 的 cookie/localStorage/sessionStorage 快照 |
| `webview_auth_data` | 获取指定 WebView 的 cookie/localStorage/sessionStorage 快照 |
| `webview_auth_data_all` | 获取 registry 中所有 WebView 的 cookie/localStorage/sessionStorage 快照 |
| `webview_iframe_auth_data` | 请求指定 WebView 中 iframe 回传并收集 cookie/localStorage/sessionStorage 快照 |

---

### 3. `packages/db` — 数据库运行时集成包（@delta-comic/db + tauri-plugin-db）

**职责**：Rust + TypeScript 混合包，封装 SQLite 数据库和本地文件存储。

#### Rust 端 (`packages/db/src/`)

| 文件 | 说明 |
|------|------|
| `src/lib.rs` | Tauri 插件入口，内嵌 `tauri-plugin-sql` + 注册 3 个 native_store 命令 |
| `src/commands.rs` | 实现 `native_store_get`、`native_store_set`、`native_store_remove` 命令 |
| `src/migrations.rs` | 4 个数据库迁移：创建文件、初始建表、修复 display_name、修复外键约束 |
| `build.rs` | 声明 native_store_* 命令供 Tauri 权限系统自动生成 |
| `permissions/default.toml` | 默认权限集：允许 native-store-get/remove/set |
| `permissions/schemas/` | 自动生成的权限 schema |

**Rust 端暴露的 Tauri 命令**：

| 命令 | 功能 |
|------|------|
| `native_store_get` | 从 `native-store/{namespace}/{key}.json` 读取值 |
| `native_store_set` | 写入值到 `native-store/{namespace}/{key}.json` |
| `native_store_remove` | 删除对应路径的文件 |

#### TypeScript 端 (`packages/db/lib/`)

| 文件 | 说明 |
|------|------|
| `lib/index.ts` | 总入口，通过 `@tauri-apps/plugin-sql` 加载 `sqlite:app.db`，构建 Kysely 实例 |
| `lib/index.test.ts` | 数据库层集成测试 |
| `lib/favourite.ts` | 收藏夹 CRUD（增删改查卡片+项，支持排序/移动） |
| `lib/history.ts` | 阅读历史记录 upsert/查询 |
| `lib/itemStore.ts` | 通用物品 KV 存储（`SourcedValue` 键值对） |
| `lib/plugin.ts` | 插件归档管理 |
| `lib/recentView.ts` | 最近浏览记录 |
| `lib/subscribe.ts` | 订阅管理（作者/EP 订阅） |
| `lib/utils.ts` | 工具函数（`withTransaction`、`countDb`） |
| `lib/nativeStore/` | 基于 SQLite `native_store` 表的响应式持久化存储，保留 localStorage 兜底迁移 |
| `lib/config.ts` | 基于 SQLite `config` 表的响应式配置存储，按所属保存表单结构与配置数据 |
| `lib/test/` | 数据库层测试辅助 |

**9 张表**：`item_store`、`history`、`recent_view`、`favourite_card`、`favourite_item`、`subscribe`、`plugin`、`native_store`、`config`

**Kysely 配置**：`CamelCasePlugin` + `SerializePlugin`，通过 `TauriSqliteDialect` 连接

---

### 4. `packages/plugin` — 插件系统（@delta-comic/plugin + tauri-plugin-plugin）

**职责**：Rust + TypeScript 混合包，提供插件生命周期管理和插件运行时 API。

#### Rust 端 (`packages/plugin/src/`)

| 文件 | 说明 |
|------|------|
| `src/lib.rs` | Tauri 插件入口，注册 plugin:* 命令 |
| `src/commands.rs` | 插件运行时命令（manifest 加载等） |
| `build.rs` | 声明 plugin 命令供权限系统自动生成 |
| `permissions/default.toml` | 默认权限集 |
| `permissions/schemas/` | 自动生成的权限 schema |

#### TypeScript 端 (`packages/plugin/lib/`)

| 文件 | 说明 |
|------|------|
| `lib/index.ts` | 总入口 |
| `lib/config.ts` | 插件配置表单生成与类型定义 |
| `lib/depends.ts` | 插件依赖解析器 |
| `lib/depends.test.ts` | 依赖解析器单元测试 |
| `lib/global.ts` | 全局插件状态管理（`Global.plugins`、`Global.config` 等） |
| `lib/driver/` | 插件驱动（各数据源适配器） |
| `lib/plugin/` | 内置 comic 插件实现 |
| `vite/index.ts` | Vite 构建插件：配置 deltaComic 插件构建、输出 manifest.json，并生成包含完整构建产物与 manifest.json 的 zip 归档 |
| `vite/index.test.ts` | deltaComic Vite 构建插件单元测试 |

**核心概念**：每个插件是一个提供页面/功能注入点的 Vue composable，包括 `searchPages`、`userActionPages`、`categories` 等。

---

### 5. `packages/ui` — UI 组件库（@delta-comic/ui）

**职责**：共享 UI 组件，基于 NaiveUI 和 Vant。

| 路径 | 说明 |
|------|------|
| `packages/ui/lib/index.ts` | 总入口，全局注册所有 UI 组件 |
| `packages/ui/lib/index.css` | 全局样式 |
| `packages/ui/lib/components/` | 通用 UI 组件 |
| `packages/ui/lib/components/DcContent.vue` | 数据状态内容容器，支持加载/错误/空状态浮层和加载态 class/style 覆写 |
| `packages/ui/lib/components/DcLoading.vue` | 通用加载指示器，支持 `spinning` 控制旋转动画和 `strokeWidth` 圆环粗细配置 |
| `packages/ui/lib/components/DcPullRefresh.vue` | 移动端触摸下拉刷新容器，使用无文本圆形加载指示，支持配置 slot 内容外层 class/style |
| `packages/ui/lib/components/DcWaterfall.vue` | 虚拟瀑布流容器，内部将 `DcContent` 固定在满高内容层中以保持状态浮层粘性显示 |
| `packages/ui/lib/message/` | 消息提示组件 |
| `packages/ui/lib/utils/` | UI 相关工具函数 |
| `packages/ui/vite/index.ts` | Vite 构建插件 |

---

### 6. `packages/app` — 主应用（@delta-comic/app）

**职责**：Tauri 桌面应用，包含 Vue 前端 + Rust 后端（`src-tauri/`）。

#### 前端核心文件

| 文件 | 说明 |
|------|------|
| `packages/app/src/main.tsx` | 应用入口，挂载 Vue 应用 + 初始化 NaiveUI/Vant/Pinia/Router |
| `packages/app/src/App.vue` | 根组件，包含 `<RouterView>` + 更新检测 + 插件加载 |
| `packages/app/src/AppSetup.vue` | 应用初始化设置界面 |
| `packages/app/src/router.ts` | Vue Router 配置（基于 `unplugin-vue-router` 文件系统路由） |
| `packages/app/src/logger.ts` | 前端日志（Sentry 集成） |
| `packages/app/src/symbol.ts` | 全局 injection key 定义 |
| `packages/app/src/icons.tsx` | SVG 图标组件集合 |
| `packages/app/src/stores/app.ts` | Pinia store — 应用全局状态 |
| `packages/app/src/stores/content.ts` | Pinia store — 内容相关状态 |
| `packages/app/src/stores/cloud.ts` | Pinia store — 云服务接入编排；离线优先，读取 core config 的启用开关和服务地址 |
| `packages/app/src/cloud/` | 云服务客户端适配层：DB/nativeStore session 与 checkpoint 存储、本地 SQLite 同步快照和远端变更应用 |
| `packages/app/src/utils/date.ts` | 日期格式化工具 |
| `packages/app/src/utils/search.tsx` | 搜索辅助组件 |
| `packages/app/src/utils/url.ts` | URL 处理工具 |

#### 前端路由全景图

```
/                            → 重定向到 /main/home/random
/cate                        → 分类浏览页面
/setting                     → 设置页面
/main                        → 主布局框架（底部 TabBar：首页/关注/Fork/插件/我的）
  ├── /main/home             →   首页框架（搜索栏 + 顶部 Tab）
  │   ├── /main/home/random  →     推荐内容流
  │   ├── /main/home/hot     →     热门内容
  │   └── /main/home/[id]    →     插件动态注入的 Tab 页
  ├── /main/subscribe        →   关注页（作者列表 + 追更状态）
  ├── /main/plugin           →   插件管理框架（NMenu 水平菜单）
  │   ├── /main/plugin/list      →  插件管理列表
  │   ├── /main/plugin/download  →  插件安装
  │   ├── /main/plugin/shop      →  插件市场（建设中）
  │   └── /main/plugin/config    →  插件配置（下载源覆写）
  ├── /main/search           →   搜索页
  └── /main/user             →   我的页面（用户卡片/收藏/历史/缓存/稍后再看/设置入口）
```

#### 前端组件目录

| 目录 | 说明 |
|------|------|
| `packages/app/src/components/` | 通用组件（createFavouriteCard、favouriteSelect、forkSelect、listAction、listSearcher、updateChecker） |
| `packages/app/src/components/home/` | 首页相关组件 |
| `packages/app/src/components/search/` | 搜索相关组件 |
| `packages/app/src/components/subscribe/` | 关注/订阅相关组件 |
| `packages/app/src/components/plugin/` | 插件管理相关组件 |
| `packages/app/src/components/user/` | 用户相关组件 |

#### Rust 后端 (`packages/app/src-tauri/`)

| 文件 | 说明 |
|------|------|
| `src-tauri/src/main.rs` | 应用入口，调用 `delta_comic::run()` |
| `src-tauri/src/lib.rs` | 核心组装：注册所有 Tauri 插件、处理 App Ready/Exit 事件 |
| `src-tauri/src/fs_scheme.rs` | 自定义 `local://` URI scheme 协议处理器 |
| `src-tauri/src/logger.rs` | Rust 端日志系统初始化 |
| `src-tauri/src/sentry.rs` | Sentry 崩溃报告初始化 |
| `src-tauri/tauri.conf.json` | Tauri 核心配置（窗口、权限、bundle） |
| `src-tauri/capabilities/default.json` | 能力声明（权限白名单） |
| `src-tauri/build.rs` | Cargo 构建脚本 |

**Tauri 插件注册顺序**（在 `lib.rs` 中）：`tauri-plugin-fs` > `tauri-plugin-utils`（Logger + `local://` scheme + WebView auth commands） > `tauri-plugin-shell` > `tauri-plugin-m3` > `tauri-plugin-better-cors-fetch` > `tauri-plugin-clipboard-manager` > `tauri-plugin-persisted-scope` > `tauri-plugin-plugin` > `tauri-plugin-aptabase` > `tauri-plugin-db`（SQLite + native_store）

---

### 7. `packages/server` — 云服务（@delta-comic/server）

**职责**：运行在 Cloudflare Workers 上的 Elysia 服务，使用 Cloudflare Vite Plugin 在本地 `workerd` 环境中开发和构建，由 Wrangler 管理配置、类型生成与部署。

| 文件 | 说明 |
|------|------|
| `packages/server/app/index.ts` | Worker 入口，启用 Elysia Cloudflare adapter，接入 `@elysiajs/cors`、`@elysiajs/openapi`、全局错误处理和无版本 `/api` 路由；导出 `App` 类型供 Eden/客户端类型共享 |
| `packages/server/app/env.ts` | Worker runtime 访问层：通过 `WeakMap<Request, AppRuntime>` 为 Elysia 路由提供 D1、secrets、vars、ExecutionContext |
| `packages/server/app/infrastructure/http/serverContext.ts` | Elysia request-scoped DI 插件：从 Cloudflare runtime 注入 `db`、`runtime`、`authService`、`syncService` |
| `packages/server/app/shared/` | API 响应、错误、crypto/hash、stable JSON、时间、HTTP auth guard/CORS 等共享基础设施；`authGuard` 使用 `@elysiajs/bearer` + Elysia `resolve` 注入 `auth` 上下文 |
| `packages/server/app/modules/auth/` | 第一方登录注册鉴权模块：用户、终端 UUID、session/token hash、注册/登录/刷新/注销/me 接口；schemas 同时作为 TypeBox 校验、类型推导、OpenAPI model 来源 |
| `packages/server/app/modules/sync/` | D1 数据同步模块：collection 白名单、snapshot 一次性推送、push 动态变更、pull checkpoint 拉取、幂等 op 记录、LWW 冲突处理、tombstone 删除；schemas 同时作为 TypeBox 校验、类型推导、OpenAPI model 来源 |
| `packages/server/app/index.test.ts` | Elysia/Worker route 级测试：覆盖 health、请求校验错误、auth guard、OpenAPI JSON 暴露 |
| `packages/server/lib/index.ts` | 客户端接入 SDK 总入口：基于 `ky` 的离线优先云服务客户端、auth/session/sync 封装、raw Eden treaty 兜底入口 |
| `packages/server/lib/client.ts` | `createCloudClient`/`useCloudServer` 客户端工厂，组合 HTTP、auth、sync 子客户端 |
| `packages/server/lib/http.ts` | `ky` HTTP 封装：`/api` 前缀、Bearer 注入、统一响应 unwrap、禁用云服务时阻止网络请求 |
| `packages/server/lib/storage.ts` | 云服务 session 存储抽象与 Memory/localStorage 实现；app 侧提供 DB/nativeStore 实现 |
| `packages/server/lib/sync/` | 客户端同步协议工具：collection 白名单、entityId 计算、stable hash、snapshot/push/pull 客户端 |
| `packages/server/migrations/0001_auth.sql` | D1 鉴权表：`auth_users`、`auth_terminals`、`auth_sessions` |
| `packages/server/migrations/0002_sync.sql` | D1 同步表：`sync_entities`、`sync_changes`、`sync_ops`、`sync_terminal_cursors` |
| `packages/server/wrangler.jsonc` | Worker 名称、入口、兼容日期、`nodejs_compat` 兼容标记、D1 binding、免费 Workers Logs 可观测性与 sync/auth vars；secrets 使用 `AUTH_PEPPER`、`TOKEN_PEPPER` |
| `packages/server/worker-configuration.d.ts` | 由 `wrangler types` 根据配置生成的 Workers 运行时类型 |
| `packages/server/vite.config.mts` | 接入 Cloudflare Vite Plugin 的 Vite+ 配置；测试模式跳过 Cloudflare 插件并配置 `@ -> app` alias |
| `packages/server/package.json` | `dev`、`build`、`preview`、`deploy`、`cf-typegen`、类型检查与 Vitest 依赖 |

**Server API 概览**：统一前缀 `/api`，不使用 `/v1` 等路径版本控制策略。`/health` 为健康检查；`/auth/register`、`/auth/login`、`/auth/refresh`、`/auth/logout`、`/auth/me` 提供第一方鉴权；`/sync/snapshot`、`/sync/push`、`/sync/pull` 提供本地 SQLite 数据同步。同步范围包括 `itemStore`、`favouriteCard`、`favouriteItem`、`history`、`recentView`、`subscribe`、`config`，明确排除 `plugin` 与 `nativeStore`。OpenAPI 文档挂载于 `/api/openapi`，JSON schema 位于 `/api/openapi/json`，鉴权路由通过 bearer security 标记。客户端接入默认离线优先：core config 中 `cloudEnabled` 默认关闭，`cloudServerUrl` 为空时不会发起网络请求；实际请求统一由 `ky` 执行。


---

### 8. `packages/server-config` — Server 系列共享配置（@delta-comic/server-config）

**职责**：为 server 系列包提供模块清单、Cloudflare binding/env 约束、管理面板路由和同步集合白名单等纯类型/常量配置，避免 Worker 与 Pages 面板重复维护配置。

| 文件 | 说明 |
|------|------|
| `packages/server-config/lib/index.ts` | 导出 `serverModules`、`defaultServerRuntimeConfig`、`serverCollections` 及相关类型 |

---

### 9. `packages/server-admin` — Cloudflare Pages 管理面板（@delta-comic/server-admin）

**职责**：运行在 Cloudflare Pages 上的 Vue 3 管理面板，复用 app/ui 技术栈（Vue、Pinia、Vue Router、NaiveUI、Vant、@delta-comic/ui），以纯静态前端方式管理/观察 `@delta-comic/server` Worker API。遵守 Pages 浏览器环境限制：不读取 Worker secret、不直接访问 D1 binding，仅通过公开的 `/api`、`/api/health`、`/api/modules`、`/api/openapi` 与 Worker 通信。

| 文件 | 说明 |
|------|------|
| `packages/server-admin/src/main.ts` | Pages 管理面板入口，注册 Pinia、Router、NaiveUI provider |
| `packages/server-admin/src/App.vue` | 管理面板整体布局与模块菜单 |
| `packages/server-admin/src/router.ts` | 管理面板路由 |
| `packages/server-admin/src/stores/admin.ts` | API 根地址与运行时配置持久化 |
| `packages/server-admin/src/pages/` | 概览、模块配置、OpenAPI 页面 |
| `packages/server-admin/src/components/dashboard/` | Server endpoint 表单、健康检查、模块概览组件 |
| `packages/server-admin/vite.config.mts` | Pages 面板 Vite+ 配置，复用 Vue/JSX/Components/Tailwind 插件 |

---

## 根目录工程配置文件

| 文件 | 说明 |
|------|------|
| `package.json` | 根 package.json，定义 monorepo 脚本 |
| `pnpm-workspace.yaml` | pnpm workspace 配置 + **catalog 统一版本管理** |
| `tsconfig.base.json` | 共享 TypeScript 基础配置 |
| `tsconfig.json` | 根级 TypeScript 配置（引用 base + node） |
| `tsconfig.node.json` | Node 端 TypeScript 配置 |
| `vite.config.ts` | 根 Vite 配置 |
| `oxfmt.config.ts` | Oxfmt 格式化配置 |
| `oxlint.config.ts` | Oxlint 代码检查配置 |
| `Cargo.toml` | Rust workspace 配置（包含 `tauri-plugin-db`、`tauri-plugin-plugin`、`delta_comic`） |
| `rustfmt.toml` | Rust 格式化配置 |
| `.commitlintrc.json` | 提交信息规范 |
| `.changeset/config.json` | Changesets 版本、changelog、发布包范围配置 |
| `cspell.json` | 拼写检查配置（自定义词库 `words.txt`） |
| `pnpm-lock.yaml` | pnpm 锁定文件 |
| `script/set-version.mts` | 同步根包、workspace 包、Tauri 配置、Cargo/Cargo.lock 版本 |
| `script/update-version.mts` | CI 构建前基于 Changesets 推算并写入版本 |
| `script/version-packages.mts` | Changesets version PR 命令：版本升级 + 根 CHANGELOG 生成 |
| `script/release-utils.mts` | Changesets release plan 读取、最高版本推算、GitHub 链接辅助函数 |
| `script/release-utils.test.ts` | 版本推算单元测试 |
| `script/release-notes.mts` | 从根 CHANGELOG 提取 GitHub Release notes |

---

## 开发命令速查

| 命令 | 作用 |
|------|------|
| `vp install` / `pnpm run vp:install` | 安装依赖（等同于 `pnpm install`；Cloud Codex 无全局 `vp` 时使用后者） |
| `vp dev` | 启动 Vite 开发服务器 |
| `vp build` | 生产构建 |
| `vp check` / `pnpm run check` | 运行 lint + fmt + typecheck |
| `vp lint` | 运行 Oxlint |
| `vp fmt` | 运行 Oxfmt 格式化 |
| `vp test` / `pnpm run test` | 运行 Vitest 测试 |
| `vp run tauri dev` | 启动 Tauri 桌面应用开发 |
| `vp run tauri build` | 构建 Tauri 桌面应用 |
| `vp run typecheck` | TypeScript 类型检查 |
| `vp run lib-build` | 构建所有库（以 app 的 build 为拓扑起点） |
| `vp run version-packages` | 执行 Changesets 版本升级并生成根 CHANGELOG |
| `vp run release` | 构建库并执行 `changeset publish` 发布 npm 包 |
| `vp run --filter @delta-comic/server dev` | 在本地 Workers 运行时启动云服务 |
| `vp run --filter @delta-comic/server cf-typegen` | 重新生成 Cloudflare Worker 类型 |
| `vp run --filter @delta-comic/server deploy` | 构建并部署 Cloudflare Worker |
| `vp run --filter @delta-comic/server-admin dev` | 启动 Cloudflare Pages 管理面板开发服务器 |
| `vp run --filter @delta-comic/server-admin deploy` | 构建并部署 Cloudflare Pages 管理面板 |
| `vp dlx` | 执行一次性二进制（替代 npx/dlx） |
| `vp add <pkg>` | 添加依赖 |
| `vp remove <pkg>` | 卸载依赖 |

注意：`vp dev` 始终运行 Vite+ 内置的 dev server。要运行自定义脚本，使用 `vp run <script>`。在 Cloud Codex 等没有全局 `vp` 的环境中，统一使用 `pnpm exec vp <command>` 或根目录 `pnpm run ...` fallback。

---

## 修改功能速查表

| 需求 | 去这里 |
|------|--------|
| 添加/修改数据类型 | `packages/model/lib/model/` 对应子模块 |
| 添加通用数据结构 | `packages/model/lib/struct/` |
| 修改数据库表结构 | `packages/db/src/migrations.rs` 新增迁移 + 更新 `lib/index.ts` DB 接口 |
| 修改配置持久化 | `packages/db/lib/config.ts` + `packages/plugin/lib/config.ts` |
| 修改数据库 CRUD 操作 | `packages/db/lib/` 对应文件 |
| 修改 native_store 命令 | `packages/db/src/commands.rs` |
| 添加/修改插件 | `packages/plugin/lib/plugin/` + `packages/plugin/lib/driver/` |
| 修改插件 Rust 命令 | `packages/plugin/src/commands.rs` |
| 修改全局 UI 组件 | `packages/ui/lib/components/` |
| 修改页面 UI | `packages/app/src/pages/` 对应路由文件 |
| 修改页面逻辑组件 | `packages/app/src/components/` 对应目录 |
| 修改路由 | `packages/app/src/router.ts` |
| 修改全局状态 | `packages/app/src/stores/` |
| 修改云服务客户端接入 | `packages/server/lib/`（协议 SDK）+ `packages/app/src/cloud/`（本地适配）+ `packages/app/src/stores/cloud.ts`（Pinia 编排） |
| 修改 Rust 后端逻辑 | `packages/app/src-tauri/src/` 对应文件 |
| 修改 Tauri 权限 | `packages/app/src-tauri/tauri.conf.json` + `capabilities/` |
| 修改工具函数 | `packages/utils/lib/` |
| 修改 WebView 外链鉴权命令 | `packages/utils/src/commands/` + `packages/utils/lib/webviewAuth.ts` |
| 修改 Android WebView cookie 兼容层 | `packages/utils/android/src/main/java/UtilsPlugin.kt` + `packages/utils/src/mobile.rs` |
| 修改 Cloudflare 云服务 | `packages/server/app/` + `packages/server/wrangler.jsonc` |
| 修改 Server 系列共享配置 | `packages/server-config/lib/index.ts` |
| 修改 Cloudflare Pages 管理面板 | `packages/server-admin/src/` + `packages/server-admin/vite.config.mts` |
| 修改样式 | `packages/ui/lib/index.css` 或各组件内的 `<style>` |
| 修改图标 | `packages/app/src/icons.tsx` |
| 修改构建配置 | 各包的 `vite.config.mts`（`plugins` 统一使用 `lazyPlugins` + 动态 `import()` 延迟加载） |
| 修改 Oxlint 规则 | `oxlint.config.ts` |
| 修改 Oxfmt 配置 | `oxfmt.config.ts` |
| 修改 pnpm catalog 依赖版本 | `pnpm-workspace.yaml` |
| 版本发布相关脚本 | `script/` 下对应文件 |
