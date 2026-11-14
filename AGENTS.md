# Pragmatic Engineering Rules

Solve the requested task with the smallest simple change that is correct, maintainable, and consistent with the existing codebase.

## Scope

* Do exactly what the task requires.
* Do not expand the scope unless it is necessary for correctness.
* Do not redesign, rewrite, or refactor unrelated code.
* Prefer modifying existing code over introducing new abstractions.
* Preserve the existing architecture, conventions, and dependencies whenever practical.

## YAGNI / KISS

* Do not implement hypothetical future requirements.
* Do not add abstractions "for future flexibility".
* Do not add interfaces, factories, registries, plugins, managers, strategies, generic frameworks, configuration systems, or extension points unless the current task actually requires them.
* Do not add a helper or abstraction merely because code could theoretically be reused later.
* Prefer straightforward code when it is sufficient.
* A small amount of duplication is preferable to unnecessary abstraction.

## Change Budget

Before making changes, identify the minimum set of files and code paths required.

Prefer:

1. Existing function over new helper.
2. Existing module over new module.
3. Existing dependency over new dependency.
4. Local change over architectural change.
5. Explicit code over additional indirection.

Every additional abstraction or dependency must have a concrete current justification.

## Refactoring

Refactor only when:

* the existing code directly prevents the requested change,
* the refactor is necessary to preserve correctness, or
* the task explicitly requests refactoring.

Do not refactor merely for elegance, consistency, or personal preference.

## Decision Rule

When multiple solutions work, prefer the one with:

* fewer changed lines,
* fewer files,
* fewer abstractions,
* fewer dependencies,
* fewer moving parts,
* less configuration,
* and easier rollback.

Do not optimize for theoretical scalability unless scalability is part of the actual requirement.

## Verification

After making the minimal change:

* run the most relevant tests, type checks, lint checks, or build commands;
* verify the requested behavior;
* inspect the final diff;
* remove accidental or unrelated changes.

Do not add tests, documentation, configuration, or infrastructure unless they are relevant to the requested behavior or required by the project.

## Stop Condition

Once the requested behavior works and the relevant checks pass, stop.

Do not continue improving the system merely because additional improvements are possible.

The goal is not to redesign the project.

The goal is to make the requested change correctly, with minimal unnecessary complexity.


# Delta Comic Agent 指南

## 工具链

- 依赖版本统一定义于根`pnpm-workspace.yaml`和`Cargo.toml`，除此之外的位置只能引用(如:`catalog:`/`{ workspace = true }`)。
- 使用 Vite+（`vp`），不要直接运行 `pnpm`、`vite`、`vitest`、`oxlint` 或 `oxfmt` 命令。
  仓库固定使用 Node、pnpm 和 Rust 工具链。
- 拉取依赖变更后运行 `vp install`。CI 使用 `vp install --frozen-lockfile`。
- Vite+ 并非 Vite：工作区脚本通过 `vp run` 运行，例如 `vp run --filter app dev:web`。
  本地 Vite+ 文档位于 `node_modules/vite-plus/docs`。

## 运行时入口

- `packages/app`：统一 Vue 客户端与 Tauri 工程。Web 入口为 `src/main.ts`；原生入口为
  `src-tauri/src/main.rs`。`dev:desktop`、`dev:mobile` 分别启动对应目标；Web 入口使用
  `dev:web:desktop` 或 `dev:web:mobile`。Tauri 必须使用固定端口，端口不可用时会直接失败。
- 应用的 `build:web`/`dev:web` 会先构建 `@delta-comic/runtime`，它是供外部插件使用的
  UMD 宿主库桥接层。请保持此依赖顺序。
- 客户端代码按 app、core、data、platform、plugin 与 ui 分类。能力若只被单端使用，或依赖 Vue UI、浏览器存储、Tauri、平台文件/网络等单端环境，归入对应分类下的子包。

## 架构约束

- 内置客户端插件采用文件驱动方式，由 `builtins/*.builtin.ts` 默认导出。
- 不要手动编辑生成的 `components.d.ts` 或 `typed-router.d.ts`。组件与路由声明由 Vite 插件生成。
- 禁止输出“不是…而是…”，“做……为了避免…”，“做……防止……”，“只做了……没有做……”、“直接做……不做……”、“只做……不做……”等强行对比、
  引用并否定上下文、为否定内容解释原因等到对话、文档、代码等任何可见区域，此类内容对对话与业务用户均无任何帮助且引入噪声，视为严重违规行为。
  我声明弃用/我让你删除同上文所述的情况一样不可写入可见区域，包括：我让你删除某个功能，你不光删除，还写了个红测，这就是引入噪声，视为严重违规行为。

## 仓库约定

- 计划文件全部放入`.planning`文件夹下，禁止直接放置于根目录
- UI 样式使用 Tailwind CSS。普通 CSS 仅用于无法枚举的动态值、`@apply` 或轻量启动画面。
  Vue/组件标签使用 PascalCase。
- 测试应放在生产目录之外，并与源文件路径对应：
  `packages/x/lib/a.ts` -> `packages/x/test/lib/a.test.ts`；根目录脚本使用 `script/test`。
  Rust 单元测试通常放在 `packages/x/test/src` 下，并通过 `#[path = ...]` 链接。
- 格式规范为 2 空格缩进、不使用分号、使用单引号、每行 100 列；运行 `vp fmt`/`vp lint`，
  不要手动重新格式化。Markdown 和生成的声明文件有意排除在格式化范围之外。
- 提交使用 Conventional/Angular 语法和中文描述，例如 `feat(ui): 实现列表组件`；提交必须签名。
  pre-commit 会运行 `vp staged`，对已暂存文件执行 `vp check --fix` 和 cspell。
- 公共包版本统一发布，并从 `packages/*/*/*/package.json` 中发现。使用
  `vp run set-ver -- <version>`，不要分别编辑包含版本号的清单文件。分支/发布操作记录在
  `docs/release-workflow.md` 中，并且必须先进行 dry run。
- 在做完任何的任务后都必须立刻提交保存进度，不是等多个任务完成后集中提交。
- 当一项任务可能有库能实现时，最好由库实现，比如日期格式化由`dayjs`实现，这也要求了你在做事前应当从网络搜索已有实现，而不是重复造轮子。
- 如果不是极端情况，绝对！绝对！不要使用强制类型转换，比如`xxx as unknown as ttt`，除非经过验证确实会报错且无法修复且逻辑正常！
- 结合上一点，项目看中的就是"类型安全"，避免滥用`any`，
  但是如果为了省下一个语义正确逻辑无误的`any`就写很多的重复代码/使用很多`as`断言/机械的换为`unknown`，本质是过度设计，也应当避免。
  全部类型约束也是很重要的，最好实现端到端类型类型覆盖，
  比如`createForm(form: FormRuls[]): FormInst`可以优化为`createForm<T extends FormRuls[]>(form: T): FormInst<T>`，
  这对于接下来的比如`FormResult<T>`就很有用，可以给出到字段级别的类型覆盖，而旧的方案很难做到。
  但是，不代表任何情况下泛型都是有用的，比如:
  ```ts
  async function countDb<TB extends keyof DB, O extends object>(
    sql: SelectQueryBuilder<DB, TB, O>,
  ) {
    const v = await sql.select(db => db.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
    return v.count
  }
  ```
  很明显，`TB`和`O`都没有在后续和返回中起到任何必要的作用，所以这是过度设计，所以应当改为:
  ```ts
  async function countDb(
    sql: SelectQueryBuilder<DB, keyof DB, object>,
  ) {
    const v = await sql.select(db => db.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
    return v.count
  }
  ```
- 对于上一点的补充，对于一些全局类型，将来会由外部注册之类的情况，可以预先暴露`interface`，结合ts的Module Augmentation功能实现类型安全。
- 不要滥用`as`断言，
  假设对于`<T extends object>(arg: T): number`的函数签名，内部使用了断言`(arg as Struct<object>).toJSON()`，
  这就导致了，若`arg`不是`Struct`，则代码会在运行时报错，所以，函数签名应当改为:
  `<T extends Struct<object>>(arg: T): number`。
- `as`断言不止`as any`，比如`(keys: readonly unknown[])=> [...static, ...keys] as EntryKey`，此时这种类型转换也不能保证正确，
  应当改为`(keys: EntryKey[])=> [...foo, ...keys]`
