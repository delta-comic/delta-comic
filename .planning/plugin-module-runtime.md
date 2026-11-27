# 第三方插件模块与级联热替换重构计划

以 `81ebde06` 的四包工作区为起点。重构完成的标志是三个独立发布的插件可以组成一条真实的调用链。设 `reader → catalog → parser`，箭头表示导入。开发者只改动 `parser`，运行中的阅读页就会使用新的解析结果。`catalog` 和 `reader` 各重新激活一次，独立运行的 `bookmarks` 保留原实例和页面状态。ZIP 安装升级也要得到同样的结果。

## 架构决定

采用 DSH 的加载顺序，**注册脚本 → 求值模块工厂 → 激活 Cordis 入口**。宿主应用使用普通 ESM 导入 Vue、Cordis 和 SDK。第三方继续写标准 ESM，由插件构建器把跨包导入编译为工厂内的 `require`。宿主在每次调用时都知道消费者是谁，因此可以记录真实依赖。插件更新时通过重建受影响的消费者切换对象引用。移除 UMD、全局库表及两处 import 文本改写，旧插件需要重新构建。

DSH 的构建预设负责封装工厂，浏览器 seed 提供宿主真实模块，模块系统区分脚本到达与求值、缓存导出并记录请求，条目管理器负责修订切换与 fiber 卸载。下文的插件命名、单包单工厂、反向闭包重建和失败恢复是 Delta Comic 的设计。参考 [构建预设](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/client/tsdown.client.ts)、[浏览器 seed](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/client/web/src/seed.ts)、[模块系统](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/client/modules/src/client/system.ts)、[条目生命周期](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/packages/client/modules/src/client/entries.ts)。

| 现有位置 | 重构后的责任 |
| --- | --- |
| `packages/platform/lib/manifest` | TypeBox 校验发布协议，定义宿主模块 ID 和 dev 事件。构建器与安装器共享这一份协议。 |
| `packages/sdk/lib/vite-plugin.ts`、`vite-dev.ts` | 通过公开入口 `@delta-comic/client/vite` 生成工厂、清单、声明入口及 ZIP。dev 监听同一个构建器的输出。 |
| `packages/runtime` | 私有 ESM 加载器。持有模块表、求值缓存和依赖图，接收宿主传入的 seed。无需依赖 Vue、Cordis、SDK、数据库或 DOM。 |
| `packages/app/src/plugin` | 提供真实 seed、脚本与资源加载、Cordis 生命周期及安装事务。保留 `builtins/*.builtin.ts` 发现机制。 |

维持四个产品包。应用通过 workspace export 导入 runtime，并在 dev/build 的任务图中保留 runtime 先构建的顺序。SDK 发布包继续封装其需要的私有 platform 代码和声明。第三方构建与执行均不需要安装私有 runtime 包。

## 插件作者交付什么

插件的安装 ID 继续用于配置和本地存储。构建器从作者的 package.json 读取 npm 包全名，写入清单的 `package` 字段，作为公共模块命名空间。例如安装 ID 为 `parser`，公共模块为 `@acme/comic-parser/text`。安装记录对安装 ID 和包名分别约束唯一性。升级必须保持两者配对。宿主保留平台模块 ID 和内置 ID，拒绝冒用及大小写歧义。

提供方在构建配置中声明公开入口。消费方在同名 npm 包的开发声明中获得类型。下面的两个代码块分别属于独立项目。

```ts
// parser 的构建配置片段，SDK 从本包 package.json 读取 name 和 version
deltaComic({
  id: 'parser',
  name: '解析器', // 插件的显示名称
  exports: { './text': './src/text.ts' },
})
```

```ts
// catalog 的源码。构建配置列出 pluginPeers: ['@acme/comic-parser']
// package.json 的 peerDependencies 给出版本范围 ^2.0.0
import { parseTitle } from '@acme/comic-parser/text'
export const titleOf = (source: string) => parseTitle(source).title
```

- **构建协议**。配置的 `exports` 映射只含本包源文件。SDK 根据同一映射输出公共子路径和对应 `.d.ts`，作者通过 npm 包中各子路径的 `types` 导出条件分发声明。消费者可用开发依赖或工作区链接完成类型检查。普通 npm 实现依赖随插件打包。消费者用构建选项 `pluginPeers` 列出跨插件包名，构建器从本包的 `peerDependencies` 读取 semver 范围，漏填即报错。宿主 seed 使用独立的精确 ID 白名单。
- **安装协议**。新清单包含 `formatVersion`、安装 ID、包名、版本、宿主版本范围、注册脚本路径、公共子路径列表、构建结果中实际引用的外部模块 ID（含静态或延迟请求）、插件 peer 范围及带 SHA-256 的资源表。外部模块 ID 保留子路径，如 `@acme/comic-parser/text`。宿主只从本次启用的安装集合解析提供方。预检所有必需 peer 的版本、子路径及命名冲突，报错给出消费方、请求、期望范围和实际版本。类型专用导入擦除后不产生运行时边。
- **修订**。同一安装 ID 同时只有一个活动版本。宿主对发布的清单原始字节计算摘要作为 `revision`，清单含资源摘要，构建器以稳定顺序序列化。dev 允许语义版本相同而修订变化。修订和会话归宿主校验，脚本不能自行选择要覆盖的旧工厂。
- **入口和副作用**。插件可以只发布代码模块，也可以提供 Cordis 组件入口。创建路由、挂样式、订阅事件和注册 UI 都通过激活上下文持有清理函数。公共模块顶层限于可重新求值的代码和包内状态。需要随更新恢复的用户数据放进既有配置或存储。

## 构建和加载如何衔接

1. **一个插件生成一个 JS 注册脚本。** SDK 生成一个入口，组合 Cordis 入口和所有公开子路径的模块命名空间，然后单次打包整个私有模块图。主入口与多个公开子路径引用同一私有缓存时，该缓存只初始化一次。CSS、图标、声明和 source map 可以单独输出。
2. **编译交给 Rolldown。** 宿主白名单与插件 peer 标为 external，使用 CJS 输出、`codeSplitting: false` 和 `dynamicImportInCjs: false`。用输出钩子包住整个 chunk，把局部 `require/module/exports` 绑定到工厂参数并返回实际的 `module.exports`。保留 source map。字面量 `import('插件/子路径')` 延迟到调用时求值。第一版预先让已声明依赖的注册脚本到达，单个插件内部以一个 JS 下载。对无法静态列举的跨包请求、带 import attributes 的外部动态导入、顶层 await 及其他会逃出工厂的输出，在构建期报文件位置。
3. **注册与执行分离。** ZIP 和 dev 都向 app 交付同一份已校验字节。app 可以用短生命周期的 Blob URL 加载普通脚本，唯一全局入口只接收注册记录。由宿主为当前脚本元素绑定期望的包和修订，要求同步注册一次。重复、遗漏、错名及过期到达均失败。完成后释放脚本节点与 URL。脚本到达只登记工厂，不执行插件代码。宿主按声明图准备依赖，并对并发到达去重。
4. **按需执行和缓存。** 一次激活代际中，同一插件工厂只求值一次。绑定到消费者的 `require(id)` 检查声明、按提供方取命名空间、记录精确模块边，并返回缓存导出。重建消费者时，即使文件修订没变也必须重新求值。缓存以活动代际区分。求值失败丢弃本次缓存和临时边。注册阶段拒绝强制依赖环并报告完整路径，执行阶段再防重入。第一版同样拒绝跨插件的延迟依赖环。
5. **宿主共享实例。** app 从自己的 ESM 图导入 `vue`、`cordis`、`pinia`、`@pinia/colada`、`vue-router`、`vue-router/experimental`、`naive-ui`、`@delta-comic/client`，以原模块名登记。seed 在页面生命周期内固定。CJS 与 ESM 的 default、namespace 和重导出约定只在工厂输出边界处理。用真实编译产物断言函数、类、注入键和响应式对象的身份，以及可变导出的读取。禁止靠复制属性伪造命名空间。

工厂协议只需一个注册入口，例如 `register({ package: name, factory })`。宿主从已绑定的脚本元素取得安装 ID 和修订。首次调用 `factory(require)` 返回 `{ modules, components }`。`modules` 按公开子路径索引 ESM 命名空间，`components` 是交给 Cordis 的组件函数列表，纯代码插件传空列表。宿主在缓存前校验返回结构和导出键集合与清单一致。函数调用产生的边绑定到发起调用的工厂代际，延迟导入也能归属到正确的消费者。

计划编写时已在本仓库安装的 Rolldown 1.3.3 上做过内存编译实验。上述选项产生一个 JS chunk。提供方把导出值从 1 改为 2 后，消费方的 `export *` 读到了 2。执行异步函数前，注入的 `require` 只收到静态依赖，执行后才收到动态依赖。真实插件 ZIP、命名空间互操作和 WebView 执行留给下面的实施验收。

## 依赖图与热替换

**声明图**用于安装、首次启动和候选版本预检，回答“这个包有资格请求哪些模块”。**运行图**记录本代际真正成功的读取，回答“谁可能持有旧导出”。边保存消费者、请求的完整 ID、提供方和代际，另建反向索引。模块边保留子路径以便诊断，失效与 fiber 重建以整个插件为单位。一个暂未调用的动态导入可以只出现在声明图。Cordis 的服务注入和清理由 Cordis 管理。同一消费方若还直接导入提供方代码，就同时受模块图约束。

以更新 `parser` 为例，安装升级、手动重载和 dev 通知进入同一条串行队列。

1. **准备。** 为候选修订写入不可变资源，校验摘要、清单及目标图，对所有启用插件的声明检查被删除子路径或不相容的版本。注册候选工厂至暂存表。任一步失败都可直接丢弃候选，当前读者继续工作。
2. **确定范围。** 从旧运行图对变更提供方求反向传递闭包。包括已求值的纯库、延迟读取过该模块的消费者及直接变更的入口。菱形路径去重。多个同时变更的根取并集。在查闭包与冻结之间不让出执行权。冻结后，拒绝旧代际回调写边或重新挂载。替换期间，无关插件首次延迟读取正在切换的提供方时，以可重试的“更新中”错误结束本次请求，提交或恢复后再解析当前活动表。候选代际始终从候选视图读取。
3. **卸载。** 按旧图先停消费者，再停提供方，示例顺序 `reader → catalog → parser`。等待各 owner 的 Cordis fiber、子 fiber、CSS、UI 注册及订阅清理完成，丢弃闭包内的导出和旧边。无关插件保留工厂缓存和 fiber。
4. **重建。** 用候选声明图确定新顺序，依次恢复所需模块及此前启用的入口，示例顺序 `parser → catalog → reader`。未改动的消费者复用旧脚本字节，重跑工厂获取新引用。等待相关 fiber 稳定后一次提交活动修订、运行图和状态。旧异步请求即使迟到，也因代际已失效而无法修改本轮结果。
5. **恢复。** 求值、激活或落库失败时，逆序卸载已启动的新入口，使用上次成功的修订与启用配置重建原闭包，再报告出错插件和阶段。文件按修订保存，SQLite 事务切换活动指针。中断重启只读取已提交指针，再清除未引用文件。恢复也失败时标记该依赖链为失败，其他链继续运行。恢复范围是宿主管理的资源，插件已提交的网络写入等外部副作用不可撤销。

禁用或卸载提供方前，根据启用插件的**声明图**列出依赖它的插件。存在依赖时拒绝此次操作并列出需要先禁用的消费者。禁用消费者之后再启用时重新检查并解析完整依赖。启动时把缺少提供方、版本冲突或坏包的依赖链标为阻塞，保留无关插件的启动机会。

dev 的 watcher 仅在完整构建成功后发布 `{ session, sequence, id, revision }`，并提供按修订读取的清单和资源。宿主忽略重复、旧会话、乱序通知。重连获取当前快照。正在执行的替换完整结束或恢复，队列合并尚未开始的中间修订。编译失败保留最后一次成功的产物和页面。移除目前在插件内注入的 Vite HMR 客户端和 CSS 文本剥离逻辑。

## 实施顺序与验收

| 步骤 | 改动与完成条件 |
| --- | --- |
| 1 · 打通一个真实外部插件 | 在 SDK 测试目录放提供方和消费方项目，通过公开的 `@delta-comic/client/vite` 构建。落地清单、外部化、工厂封装和类型产物。验证普通 import、默认导出、`export *`、可变绑定、延迟 import、Vue SFC 和 CSS。在消费者类型检查中故意引用错误字段必须报错。 |
| 2 · 实现加载器与宿主 seed | 先以包内独立入口开发新加载器，等步骤 5 一次切换宿主和 SDK 的默认入口。在 runtime 单测覆盖登记、求值去重、失败重试、正反向边、循环路径和 stale generation。用真实浏览器运行步骤 1 的产物，断言宿主与两个插件共享 Vue、Cordis 和 SDK 对象。同时覆盖多个公开子路径共享同一个私有对象。 |
| 3 · 接通安装与启动 | 改造 `install/artifact.ts`、`install/moduleReader.ts`、`adapters/fileStore.ts` 和相关 Rust 文件路径、数据库迁移。ZIP、IndexedDB、Tauri 文件后端和 dev 均提供按修订读取的字节。启动分成清单索引、脚本到达、组件激活。用正式 ZIP 测试离线冷启动、同版本不同内容、摘要错误和中断重启。 |
| 4 · 接通级联替换 | 将 `composition.ts` 中单插件 `reloadForInstall`、手动重载及 dev 重连收敛到上述操作。用三层链、独立插件、菱形与延迟导入夹具记录工厂、mount、dispose 次数与顺序。注入候选构建、注册、激活、落库及恢复失败，核对活动指针、CSS 数量与诊断。 |
| 5 · 切换开发与生产，删除旧路 | app workspace 依赖切到 ESM runtime，删除 `index.html` 的 UMD 脚本、`delta-comic:copy-runtime`、`window.$$lib$$`、platform 的 `externalizeSharedRuntime`/`exposeHostLibraries`、`install/moduleGraph.ts` 的 Blob import 改写和旧测试。逐项检查遗留依赖。旧清单直接提示“使用新版 SDK 重新构建”，既有旧安装标记为待重装，禁止执行。同步插件架构文档、AGENTS 的运行时说明和工作区依赖图。 |

每一步形成一个可验证的签名提交。测试按仓库约定放在各包的 `test/` 目录。最终验收覆盖以下三项。

1. 使用 `vp run build:packages`、`vp run typecheck`、`vp test run` 检查构建、公开类型和测试。原生文件或数据库实现有改动时执行 `cargo test --workspace --locked`。依次运行 `vp run @delta-comic/app#build:web:desktop`、`vp run @delta-comic/app#build:web:mobile`，检查两个发布目录和外部插件产物都已脱离旧 UMD。
2. 在浏览器和实际 Tauri desktop/mobile WebView 安装三个独立构建的 ZIP 和一个无关插件，打开真实阅读页。先走 ZIP 升级，再让开发服务器替换同一提供方。两次均记录四个插件的修订、工厂执行次数、fiber、DOM 显示和挂载/卸载顺序。阅读页无需刷新，书签页的编辑状态和对象身份保留。
3. 在同一场景加入两个断言。尚未运行延迟导入时升级，消费者不重启且首次调用读到新版。让新版在激活中抛错，原解析结果恢复，每个路由、样式和订阅仅存一份。最后移除提供方的公开子路径，确认预检在卸载任何 fiber 前返回准确依赖链。
