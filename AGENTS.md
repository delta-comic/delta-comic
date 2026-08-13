# Delta Comic Agent 指南

## 工具链

- 使用 Vite+（`vp`），不要直接运行 `pnpm`、`vite`、`vitest`、`oxlint` 或 `oxfmt`
  命令。仓库固定使用 Node `25.9.0`、pnpm `12.0.0-rc.3` 和
  `nightly-2026-08-12` Rust 工具链（MSRV `1.95.0`，2024 edition）。
- 拉取依赖变更后运行 `vp install`。CI 使用 `vp install --frozen-lockfile`。
- Vite+ 并非 Vite：工作区脚本通过 `vp run` 运行，例如
  `vp run --filter app dev:web`。本地 Vite+ 文档位于 `node_modules/vite-plus/docs`。
- 本地会话中使用全局 `vp`；仅在没有全局 CLI 时使用 `pnpm exec vp`。

## 验证

- 执行 Web 检查或测试前，先构建应用依赖：`vp run lib-build`。多个包导出构建后的
  `dist` 文件，否则全新检出的仓库可能无法解析这些依赖。
- 完整的 Web 验证流程：依次运行 `vp run lib-build`、`vp check`、
  `vp run -r typecheck`，然后运行 `vp test run`。由于根目录 lint 的类型检查已禁用，
  `vp check` 不能替代显式的工作区类型检查。
- 使用 `vp test run packages/app/test/src/path/file.test.ts` 运行单个测试文件；添加
  `-t 'test name'` 可聚焦单个测试用例。测试监听模式为 `vp test watch <path>`。
- 覆盖率检查命令为 `vp test run --coverage`；根目录阈值为行、函数和语句 75%，分支 70%。
- Rust 验证需单独执行：`cargo fmt --all --check`、
  `cargo clippy --workspace --all-targets --locked -- -D warnings` 和
  `cargo test --workspace --locked -- --test-threads=2`。
- 修改 `packages/downloader/android` 下的内容时，还必须运行 Gradle 的 `ktlintCheck`、
  `lintDebug` 和 `testDebugUnitTest` 任务。CI 使用的具体 JDK 21/Android 36 配置位于
  `.github/workflows/{lint,test}.yaml`。

## 运行时入口

- `packages/app`：Vue/Tauri 客户端。Web 入口为 `src/main.tsx`；原生入口为
  `src-tauri/src/main.rs`。`vp run --filter app dev` 启动 Tauri；`dev:web` 仅启动 Web
  客户端。Tauri 必须使用端口 `5173`，端口不可用时会直接失败，而不会选择其他端口。
- 应用的 `build:web`/`dev:web` 会先构建 `@delta-comic/runtime`，它是供外部插件使用的
  UMD 宿主库桥接层。请保持此依赖顺序。
- `packages/server/app/index.ts`：Elysia Cloudflare Worker 入口。
  `packages/server/lib/index.ts` 是客户端/共享公共 API，并非 Worker 入口。本地启动前必须先运行
  `vp run --filter @delta-comic/server migrate:local`，然后再运行 `... dev`。
- `packages/server-admin` 是独立的 Vue 管理应用。功能通过
  `src/features/*/feature.ts` 自动发现；应添加功能模块，而不是编辑集中式路由列表。
- `packages/{db,downloader,logger,model,plugin,ui,utils}` 是可发布的工作区；其中一些还通过
  根 Cargo 工作区映射到 Rust Tauri 插件 crate。`packages/runtime`、`app`、`server` 和
  `server-admin` 是私有包。

## 架构约束

- 修改插件时遵循 `packages/plugin/ARCHITECTURE.md`。只有 `composition.ts` 可以组装具体的
  capability/adapter；`index.ts` 仅用于导出；包内代码不得自引用 `@delta-comic/plugin` 或
  `@/index`。
- 内置客户端插件采用文件驱动方式，由 `builtins/*.builtin.ts` 默认导出。服务端内置插件有所不同：
  Wrangler 不会转换 `import.meta.glob`，因此需要在
  `packages/server/app/modules/plugins/definitions/index.ts` 中添加显式 ESM 导入。
- 部署服务端时不会应用 D1 迁移。执行 `deploy` 前，显式运行该包的 `migrate:remote`；
  本地 D1 使用 `migrate:local`。
- 不要手动编辑生成的 `components.d.ts`、`typed-router.d.ts` 或
  `packages/server/worker-configuration.d.ts`。组件/路由声明由 Vite 插件生成；Worker 绑定由
  `vp run --filter @delta-comic/server cf-typegen` 生成。

## 仓库约定

- UI 样式使用 Tailwind CSS。普通 CSS 仅用于无法枚举的动态值、`@apply` 或轻量启动画面。
  Vue/组件标签使用 PascalCase。
- 每个新增的应用内用户可见字符串都必须使用 i18n，并更新
  `packages/app/src/i18n/locales/en-US.ts`、`zh-CN.ts` 和 `zh-TW.ts`。共享 UI 消息使用
  `packages/app/src/main.tsx` 中配置的 `ui.*` 桥接。
- 测试应放在生产目录之外，并与源文件路径对应：
  `packages/x/lib/a.ts` -> `packages/x/test/lib/a.test.ts`；根目录脚本使用 `script/test`。
  Rust 单元测试通常放在 `packages/x/test/src` 下，并通过 `#[path = ...]` 链接。
- 格式规范为 2 空格缩进、不使用分号、使用单引号、每行 100 列；运行 `vp fmt`/`vp lint`，
  不要手动重新格式化。Markdown 和生成的声明文件有意排除在格式化范围之外。
- 提交使用 Conventional/Angular 语法和中文描述，例如 `feat(ui): 实现列表组件`；提交必须签名。
  pre-commit 会运行 `vp staged`，对已暂存文件执行 `vp check --fix` 和 cspell。
- 公共包版本统一发布，并从 `packages/*/package.json` 中发现。使用
  `vp run set-ver -- <version>`，不要分别编辑包含版本号的清单文件。分支/发布操作记录在
  `docs/release-workflow.md` 中，并且必须先进行 dry run。
- 在做完任何的任务后都必须立刻提交保存进度，不是等多个任务完成后集中提交
- 当一项任务可能有库能实现时，最好由库实现，比如日期格式化由`dayjs`实现
