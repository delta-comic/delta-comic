# Plugin 6G 独立包拆分设计

## 1. 目标与范围

阶段 6G 将现有 `@delta-comic/plugin` 中混合的协议、Loader、安装、运行时和 Vite 开发适配职责拆分为独立 workspace 包，同时保留现有客户端插件行为、安装格式、运行时生命周期和 Vite 原生 HMR 行为。

本阶段交付：

- source-agnostic Loader 契约与实现包
- Install 契约、安装服务、来源/codec/module reader 组合包
- Runtime 生命周期与 provider/store 包
- Vite build/dev adapter 包
- `@delta-comic/plugin` 聚合入口和唯一 composition root
- 对应测试、包导出、依赖、发布清单和架构约束迁移

阶段 6E 中的 marketplace 管理界面、发布者身份、CAS、artifact 上传、Workers for Platforms provisioning 和完整部署流水线继续作为后续事项记录，不混入 6G 的包边界迁移。

## 2. 设计原则

### 2.1 依赖方向

最终依赖图：

```text
plugin-manifest ──┐
plugin-artifact ──┼──> plugin-loader ──> plugin-api
                  │                    └──> plugin-kernel
                  └──> plugin-install ──> plugin-loader
                                      └──> plugin-manifest/artifact
plugin-runtime ──> plugin-api + plugin-kernel
plugin-vite ──> plugin-manifest + plugin-install contracts + Vite
plugin (composition/aggregate) ──> all public plugin packages + app adapters
```

包内代码禁止通过 `@delta-comic/plugin` 或自身 `@/index` 反向导入。每个独立包的 `index.ts` 只负责导出，具体组合只允许出现在 `composition.ts` 或对应 adapter entry。

### 2.2 公共协议复用

`@delta-comic/plugin-manifest` 是 Manifest 类型、schema 和 parser 的唯一来源；`@delta-comic/plugin-artifact` 是 artifact 文件、完整性和资源依赖校验的唯一来源。旧 `@delta-comic/model` 中与插件协议重复的类型在迁移过程中通过明确的类型别名或字段适配消除，避免形成双协议。

### 2.3 行为保持

- candidate 的 builtin/installed 统一模型保持不变
- dependency plan、collision、preload、onPreboot、normal activation、rollback、reload、disable、uninstall 语义保持不变
- ZIP stored reader、`dev:<port>` reader 和来源 resolver 仍由 install/composition 区分
- Vite 使用 `/@vite/client` 原生 HMR、`/index.css` 独立 CSS bridge、Vue SFC style module 聚合和跨源 CORS
- mutable host registration 继续通过 `PluginScope` 以 LIFO 顺序撤销

## 3. 包职责

### 3.1 `@delta-comic/plugin-kernel`

承载 source-agnostic 核心模型：candidate、provider、dependency planner、capability、contribution hub 和 scope。它只依赖协议/API 所需的纯类型，不依赖 Vue、数据库、Tauri、文件系统、网络或 Vite。

### 3.2 `@delta-comic/plugin-loader`

承载 candidate module loading 的最小契约和通用 helper：`LoadedPluginModule`、module reader 组合、入口形状检查以及 loader 相关错误/结果类型。Loader 不获取来源、不访问数据库、不决定安装顺序；它接收 candidate 或已经解码的模块输入，并把模块交给 runtime。

若现有 candidate 类型与 Loader 契约存在循环依赖，则 Loader 复用 kernel 的 candidate/module 类型，具体 stored/dev reader 留在 Install 包，由 composition 注入 `PluginModuleReader`。

### 3.3 `@delta-comic/plugin-runtime`

迁移 `PluginRuntime`、provider、store 及运行时报告/操作类型。Runtime 只依赖 API、kernel 和 loader contracts；Vue 作为 runtime 的宿主渲染依赖保留在该包的 peerDependencies。它不导入 install repository、codec、source resolver、数据库、Tauri 或具体文件存储。

### 3.4 `@delta-comic/plugin-install`

承载 Install public contracts、`PluginInstallService`、来源 resolver、package codec、stored/dev module reader、candidate provider 和通用 repository/file-store ports。所有输入来源通过 resolver/codec/reader port 注入；安装服务不直接导入应用 presentation 或 runtime engine。

数据库 repository、Tauri 文件存储、市场客户端和 Awesome Registry client 作为 `@delta-comic/plugin` 的 concrete adapters 保留在 composition 侧，或拆为 adapter-only 子包；它们不得进入 install core 的依赖图。

### 3.5 `@delta-comic/plugin-vite`

承载 Vite build/dev adapter、manifest wiring、plugin ZIP 输出、host external 配置和原生 HMR/CSS bridge。它依赖 Vite、Manifest、artifact 相关协议和通用 install/dev contracts，不依赖 runtime engine、数据库或 app services。

### 3.6 `@delta-comic/plugin`

作为聚合包和应用组合入口：保留公共 re-export、capabilities、builtins、具体 adapters、`composition.ts` 和宿主 integration。它负责组装数据库 repository、文件存储、source resolver、codec、module reader、runtime provider 和 runtime；具体 app service 依赖集中在这里。

## 4. 迁移顺序

按以下顺序逐批迁移，每批均包含实现、测试、包构建、类型检查和提交：

1. **Kernel/Loader contracts**：先抽取无副作用的 candidate/module contract，确保 runtime 和 install 有稳定边界。
2. **Runtime**：迁移 engine/providers/store，替换内部相对导入，运行时测试改用新包入口。
3. **Install**：迁移 contracts、service、codec/source/moduleReader/candidateProvider；把数据库 repository 与 app adapters 留在 composition。
4. **Vite adapter**：迁移 build/dev 实现及真实 Vue SFC/CSS HMR 集成测试。
5. **聚合包收敛**：更新 composition、builtins、capabilities、app/server 调用方和 exports；删除重复实现与 legacy 路径。
6. **发布与文档**：将新 public packages 纳入版本同步、release workspace、lockfile 和阶段规划记录。

迁移期间允许聚合包暂时 re-export 新包，但新包内部不得依赖聚合包。最终所有旧职责路径必须从聚合包内部移除，旧路径是否保留由当前无兼容承诺的架构决策决定；本阶段默认删除已迁移的旧子路径。

## 5. 错误与生命周期

- Loader 入口形状错误、manifest id 不匹配和 module import 失败都转换为带 plugin id/source context 的 typed error，并由 runtime 记录 failure report。
- Install 继续使用 file replacement 与 archive upsert 的补偿事务；任何递归依赖失败按已添加依赖的逆序卸载。
- Runtime 的 preload/activation 失败继续执行 scope dispose 和 prepared-module cleanup，保留旧 active version；reload 失败时报告 `restartRequired` 状态。
- Vite endpoint 请求继续设置 CORS/no-store；CSS 更新只替换宿主持有的 style 节点，不重复注入 Vite runtime。
- 安全约束：来源 resolver 的日志禁止输出 token；ZIP 路径必须拒绝绝对路径、盘符、NUL 和 `..`；完整性校验统一使用 artifact protocol。

## 6. 测试与验收

每个新包拥有独立 `test/`，测试路径与源文件对应；聚合包保留 composition、builtins 和 app adapter 集成测试。

最低验收矩阵：

- kernel/loader：candidate contract、入口形状、依赖计划、scope LIFO、collision 和失败回滚
- runtime：preload、normal activation、dynamic enable/disable/reload/unload、provider collision、store 状态和 recovery
- install：source matching、codec/path/integrity、递归依赖、重复安装、补偿回滚、archive/file-store ports、stored/dev module readers
- Vite：manifest wiring、ZIP 输出、host externals、native HMR、CSS bridge、Vue SFC style aggregation、relative assets
- architecture：依赖方向、index export-only、无 self-import、无 legacy global/export/module、composition 唯一 concrete assembly
- workspace：`vp install`、`vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run`、`vp run codegen:check`、`git diff --check`

## 7. 完成标准

6G 完成需同时满足：

1. 新包职责和依赖图与本 spec 一致，且所有包可独立构建与类型检查。
2. 现有插件安装、加载、运行、停用、重载、卸载和开发 HMR 测试全部通过。
3. `@delta-comic/plugin` 仅保留聚合/组合和应用 concrete adapters，不再承载重复的 Loader/Install/Runtime/Vite 核心实现。
4. 发布清单、版本同步和 lockfile 已更新，工作区无未提交变更。
5. 每个阶段提交均使用签名 Conventional/Angular 中文提交信息，并在规划文件中记录验证结果和遗留事项。
