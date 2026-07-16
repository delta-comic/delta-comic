# 项目规范

## Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at <https://viteplus.dev/guide/>.

### Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

### Notice

When working in a local development environment, use `vp` instead of `pnpm exec vp`.

In cloud environments, use `pnpm exec vp`.

---

## 开发思想

### 思想

- 使用文件系统分割模块来保证结构工整；对于按步骤流程运行不同模块的，或许可以使用glob引入执行实现由文件驱动模块
- 优先使用`oop`(面向对象)思想编写代码，但要避免过度封装，继承链最好不要超过5层(非强制)
- 使用`依赖注入`思想优化耦合，但也要避免过度封装。
- 使用类似`条件反转`等技巧减少代码嵌套，但不要过度的不加分辨的使用

### 格式

- css**一定**要使用tailwindcss(包含`不可枚举的动态值属性`除外和使用`@apply`除外)，如果你使用了纯css则你的设计是失败的，应当重做。如果是在`开屏页面`这种地方也除外，因为场景太轻量且加载性能敏感。
- 提交遵循Angular规则，但描述内容使用中文，如`feat(ui): 实现了列表组件`
- 组件样式必须使用PascalCase，例如: `<NButton></NButton>`、`<DcList></DcList>`
- 格式化请使用`vp fmt`和`vp lint`，最好不要手动修复格式问题
- 最好遵守`dry`(不要重复自己)规则
- 对于重复使用相同或相似的dom结构的，最好使用`提取组件`或`v-for`或vueuse的`createReusableTemplate`创建复用，这与上一条的`dry`思想相同

## 项目概览

**delta-comic** 是基于 **Tauri 2.x** 的跨平台漫画阅读应用，支持 Android 和桌面端。采用 **pnpm monorepo** 架构。

- **前端**: Vue 3 + TypeScript 6 + Vite + NaiveUI + Pinia + Vue Router
- **后端**: Rust (Tauri 2.x, edition 2024) + SQLite + Kysely ORM
- **云服务**: Elysia + Cloudflare Workers + Cloudflare Vite Plugin + Wrangler
- **数据库**: 本地 SQLite，由 `tauri-plugin-sql` 提供 Rust 驱动，Kysely 做类型安全查询
- **插件系统**: 分级可扩展架构，Rust 端提供命令 API，TS 端通过 Composition API 注入页面和功能
- **线上仓库**: <https://github.com/delta-comic/delta-comic.git>
- **依赖管理**: 使用 pnpm catalog 统一管理所有依赖版本（见 `pnpm-workspace.yaml`）

## 要点

- 添加ui文本记得使用i18n