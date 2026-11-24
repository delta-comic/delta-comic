# Dev 插件 HMR 重构计划

## 目标

重构开发插件的热更新链路，让开发插件作为宿主 Cordis 生命周期中的一等插件运行，并直接遵循 Vite HMR 的模块接受、失效和 dispose 语义。Vite 负责发现与传播模块更新，宿主负责替换该插件的 Cordis 子树及其资源。移除旧的全局自定义更新事件和并行的更新通知约定，不提供兼容适配。

## 当前实现

- `packages/plugin/vite/lib/dev.ts` 生成 `/index.js` 入口。入口对业务入口调用 `hot.accept`，再监听 `vite:afterUpdate` 并派发全局 `delta-comic:plugin-update` 事件。
- `packages/plugin/core/lib/composition.ts` 监听该全局事件、按插件 ID 过滤、手动重载组件，并刷新 CSS。
- `packages/plugin/install/lib/moduleReader.ts` 在宿主动态导入开发服务器入口，验证默认导出的函数数组，另行请求 CSS，并返回 `refreshStyle`。
- 安装器的 `dev` 来源、归档来源都进入同一套模块读取和安装记录。HMR 的 Vite 侧协议与宿主 Cordis 生命周期由多个包共同维护。

## 设计

### 1. 以 Vite HMR 模块边界承载插件替换

把开发入口设为唯一 HMR 接受边界。入口模块使用 Vite 的 `import.meta.hot.accept` 接收插件模块的新导出，并通过 `import.meta.hot.dispose` 清理属于本模块的监听、状态和临时资源。开发插件的模块导出保持一个明确的宿主契约，供宿主 Cordis 插件实例消费。

删除 `vite:afterUpdate` 全局监听和 `delta-comic:plugin-update` 自定义事件。不要在 Vite 已提供模块更新回调后再以全局事件广播更新。对于无法被接受的更新，遵循 Vite 的失效与完整重载路径。

### 2. 让 Cordis 插件实例拥有宿主更新生命周期

在宿主为每个开发插件建立一个受管理的 Cordis 插件/子上下文。实例持有当前模块导出、插件 Fiber、CSS 资源和 HMR 会话状态。Vite 接受新模块后，将新导出交给该实例执行替换：先准备新模块，再释放旧 Fiber 所有的 effect 和服务注册，随后挂载新模块。更新失败时记录该插件失败状态并清理半激活的新实例，不触发其他插件的卸载或全局安全模式。

让插件卸载、禁用、来源切换、宿主销毁都释放相同的 Cordis 实例和 Vite HMR 订阅。迟到的更新必须通过实例代次校验，不能复活已经卸载的插件。

### 3. 与 Vite 模块图和 CSS 更新协同

保留 Vite 开发服务器作为模块解析、转换、依赖追踪和更新传播的唯一来源。业务模块的接受范围应覆盖插件入口依赖图，避免额外轮询或自行比较源文件。

CSS 使用 Vite 已处理的样式模块更新结果。宿主可继续通过专用 CSS 资源端点把样式应用到宿主文档，但刷新触发应来自当前插件入口的 Vite HMR 更新，而不是全局事件或独立定时请求。确保初始无 CSS 后新增、CSS 删除、Vue SFC 样式变更均能正确更新，并且同一插件始终只有一份宿主样式。

### 4. 收敛开发模块读取契约

明确区分首次导入和热替换。首次导入创建 Cordis 实例；后续 HMR 接受回调只替换模块导出，不重新走安装解析、持久化或 manifest 请求。manifest 仍在安装和显式重连时校验插件身份。删除 `LoadedPluginModule.dev.refreshStyle` 等由 reader 暴露、由 composition 特判的跨层控制字段，改由开发插件运行时实例持有 HMR 更新能力和样式清理句柄。

### 5. 破坏性迁移

- 删除 `DEV_UPDATE_EVENT`、旧的全局事件监听和事件 payload 类型。
- 删除 `vite:afterUpdate` 适配层及仅服务于旧更新链路的 reader 字段。
- 更新 `@delta-comic/plugin-install`、`@delta-comic/plugin-vite`、`@delta-comic/plugin-core` 的公开契约和对应测试，不保留旧导出别名。
- 所有内置插件仍不进入开发服务器 HMR 路径。归档插件保持现有静态加载和卸载行为。

## 实施阶段

1. 定义宿主 Cordis HMR 实例的输入、更新、dispose 契约，以及开发入口的 Vite `accept`/`dispose` 边界。
2. 重写 Vite 开发入口和插件 API，移除全局更新事件桥接，验证模块依赖更新与完整失效行为。
3. 在插件核心中实现受管理的开发插件 Cordis 实例，串联新模块替换、Fiber 释放、失败状态与实例代次。
4. 将开发 CSS 更新接入该实例的 Vite 更新回调，处理新增、修改、删除和空样式状态。
5. 删除旧契约、旧事件测试与迁移分支，更新开发插件架构文档。

## 验收

- 修改插件入口自身后，Vite 接受更新并只替换对应插件的 Cordis 实例。
- 修改入口依赖、嵌套依赖和 Vue SFC 后，Vite 模块图能传播更新；不可接受的更新遵循 Vite 完整重载语义。
- 更新后旧 Fiber 的命令、菜单、服务注册和 effect 均已释放，新导出只挂载一次。
- CSS 热更新、删除和从无样式到有样式都正确，宿主文档中每个插件只有一份样式节点。
- 插件激活抛错时该插件进入错误状态，其他插件保持活动；修复源码后可由下一次 Vite 更新恢复。
- 禁用、卸载、切换归档来源或销毁宿主后，旧 HMR 会话不能继续更新或重新挂载插件。
- 移除旧自定义事件后，仓库中不存在遗留生产引用；相关包测试、构建和应用类型检查通过，并用真实 Vite 开发服务器验证 Web 与桌面宿主热更新。
