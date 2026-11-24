# Dev 插件 HMR 重构计划

## 目标

重构开发插件的热更新链路，明确管理三个不同但需要协作的部分：宿主 Vite HMR 更新宿主应用自身，Cordis HMR 管理宿主中的 Cordis 插件生命周期，插件自己的 Vite HMR 更新开发插件源码。开发插件 Vite 检测到插件源码更新后通知宿主，宿主通过 Cordis HMR dispose 并重新注入该插件的最新入口，使插件逻辑与 UI 一起更新。三者不能互相冒充，也不能用宿主 Vite 的模块图替代插件 Vite 的模块图。允许破坏性变更，不保留旧更新协议。

## 当前实现

- 宿主应用由 `packages/app` 的宿主 Vite 服务器运行，因此宿主应用自身的模块更新由宿主 Vite HMR 管理。该 HMR 域不负责开发插件源码。
- 开发插件由开发者启动的另一个 Vite 服务器运行。`packages/plugin/vite/lib/dev.ts` 生成 `/index.js` 入口，使用插件 Vite 的 `import.meta.hot.accept` 接受插件入口更新，再监听 `vite:afterUpdate` 并派发全局 `delta-comic:plugin-update` 事件。
- `packages/plugin/core/lib/composition.ts` 监听全局事件，按插件 ID 过滤，手动重载组件并刷新 CSS。Cordis Fiber 生命周期和插件 Vite 更新桥接目前由宿主自行编排，没有由 Cordis HMR 统一管理。
- `packages/plugin/install/lib/moduleReader.ts` 由宿主动态导入插件 Vite 服务提供的入口，验证默认导出的函数数组，另行请求 CSS，并返回 `refreshStyle`。
- 当前三层 HMR 关系没有清晰建模，开发插件 Vite 的更新经自定义浏览器事件绕过 Cordis HMR 管理，且容易与宿主 Vite HMR 的职责混淆。

## 设计

### 1. 保持两个 Vite HMR 域相互独立

宿主 Vite HMR 继续管理宿主应用的模块图和宿主代码更新。插件 Vite HMR 管理开发插件自己的模块图、依赖更新和失效传播。宿主加载插件入口时必须显式连接到插件 Vite 服务，不能将插件模块纳入宿主 Vite 的模块图，也不能让宿主更新事件代替插件更新事件。

插件 Vite 负责监听自身模块图中的 TS/JS、Vue SFC 模板、脚本和样式变化。插件入口接收更新后，桥接层只向宿主发送带插件 ID 和会话代次的失效通知，不把新模块对象当作 Cordis 实例替换结果。该通知通过插件 Vite 客户端与宿主页面之间的明确消息桥接传递。宿主收到通知后调用 Cordis HMR dispose 旧 Fiber，再从插件 Vite 服务重新导入最新入口并挂载，从而让插件 UI 随插件逻辑一起重新注入。不能被插件入口接收的更新仍遵循插件 Vite 的失效路径。整个流程不依赖宿主 Vite 模块图。

### 2. 由 Cordis HMR 管理插件实例替换

参考 `@cordisjs/hmr` 的设计，让每个开发插件作为可被 HMR 管理的 Cordis 插件/子上下文运行。Cordis HMR 是插件运行时生命周期管理层，负责 dispose 旧 Fiber 及其注册的 effect/服务，再重新读取并挂载插件 Vite 当前提供的完整入口。每次插件 Vite 接受更新都触发这条 dispose→重新导入→挂载链路，保证插件 UI（包括 Vue 组件）与插件逻辑使用同一版本。宿主 Vite HMR 更新宿主代码，不承接插件源码更新。

安装、卸载、禁用、来源切换和宿主销毁都通过统一的 Cordis HMR 实例边界释放插件上下文及插件 Vite HMR 订阅。迟到的插件更新不得复活已失效的实例。替换失败只影响对应开发插件，不触发其他插件卸载或全局安全模式。

### 3. 与 Vite 模块图和 CSS 更新协同

插件源码的解析、转换、依赖追踪和更新传播完全由插件自己的 Vite 服务负责。宿主只消费插件 Vite 暴露的入口和 HMR 更新 API。业务模块接受范围应覆盖插件入口依赖图，避免额外轮询或自行比较源文件。

JS、Vue SFC 模板/脚本和 CSS 任一变化都使插件入口失效并触发 Cordis HMR 重新注入，不让 Vue HMR 在 Cordis 生命周期之外单独替换插件 UI。插件 Vite 负责转换并提供最新样式，旧 Fiber dispose 时移除旧样式，新 Fiber 激活时注入新样式。宿主 Vite HMR 不接管插件 CSS。初始无 CSS 后新增、CSS 删除和 Vue SFC 样式变更都走同一重新注入路径，且同一插件始终只有一份宿主样式。

### 4. 收敛开发模块读取契约

明确区分首次导入和热替换。首次导入通过插件 Vite 服务取得模块，再由 Cordis HMR 建立插件实例；后续插件 Vite HMR 通知宿主失效后，由 Cordis HMR dispose 旧实例并重新从插件 Vite 入口导入完整最新模块，不重新走安装解析、持久化或 manifest 请求。manifest 仍在安装和显式重连时校验插件身份。删除 `LoadedPluginModule.dev.refreshStyle` 等由 reader 暴露、由 composition 特判的跨层控制字段，改由开发插件的 Cordis HMR 实例持有更新能力和样式清理句柄。

### 5. 破坏性迁移

- 删除 `DEV_UPDATE_EVENT`、旧的全局事件监听和事件 payload 类型。
- 删除 `vite:afterUpdate` 全局事件适配层及仅服务于旧更新链路的 reader 字段，改为插件 Vite 到 Cordis HMR 的直接更新接口。
- 更新 `@delta-comic/plugin-install`、`@delta-comic/plugin-vite`、`@delta-comic/plugin` 的公开契约和对应测试，不保留旧导出别名。
- 所有内置插件仍不进入开发服务器 HMR 路径。归档插件保持现有静态加载和卸载行为。

## 实施阶段

1. 明确宿主 Vite HMR、插件 Vite HMR 和 Cordis HMR 的职责、模块边界、通信接口及 dispose 所有权。
2. 按 `@cordisjs/hmr` 的设计为开发插件建立 Cordis HMR 生命周期，并确保宿主 Vite HMR 与插件 Vite HMR 的 HMR 上下文独立。
3. 重写插件 Vite 开发入口与桥接 API，移除全局更新事件，验证插件依赖图更新与失效行为。
4. 在插件核心中接入 Cordis HMR 替换，处理 Fiber 释放、失败状态、会话代次和宿主/插件 Vite 服务断连。
5. 让插件 Vite 对 JS、Vue SFC 和 CSS 变更统一发送插件失效通知，由 Cordis HMR dispose 并重新导入、注入最新插件，验证 UI 与逻辑同步更新及样式资源生命周期。
6. 删除旧契约、旧事件测试与迁移分支，更新文档并完成真实双 Vite 服务验证。

## 验收

- 修改宿主代码时只触发宿主 Vite HMR，宿主自身更新正常且不会重载开发插件实例。
- 修改插件代码时只由插件 Vite HMR 传播更新，并由 Cordis HMR 只替换对应插件实例。
- 修改入口依赖、嵌套依赖、Vue SFC 模板/脚本或 CSS 后，插件 Vite 能触发对应插件的 Cordis dispose 和重新导入挂载；UI 与逻辑均来自最新模块，不能接受的更新遵循插件 Vite 的失效语义。
- 更新后旧 Fiber 的命令、菜单、服务注册和 effect 均已释放，新导出只挂载一次。
- 插件 UI、Vue SFC 与逻辑在每次插件 Vite 更新后一起重新注入；CSS 修改、删除和从无样式到有样式都正确，宿主文档中每个插件只有一份样式节点。
- 插件激活抛错时该插件进入错误状态，其他插件保持活动；修复源码后可由下一次 Vite 更新恢复。
- 禁用、卸载、切换归档来源或销毁宿主后，旧 HMR 会话不能继续更新或重新挂载插件。
- 移除旧自定义事件后，仓库中不存在遗留生产引用；相关包测试、构建和应用类型检查通过，并用真实 Vite 开发服务器验证 Web 与桌面宿主热更新。
