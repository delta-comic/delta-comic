# Delta Comic 插件开发指南

本文面向 Delta Comic 3.x 插件作者，覆盖从创建一个最小插件，到配置、国际化、内容模型、生命周期、调试、打包和发布的完整流程。

本文以当前仓库的插件 API 为准：

- 插件包：`@delta-comic/plugin@3.0.0-next.9`
- 插件 API：`apiVersion: 1`
- 构建工具：Vite+ 与 `@delta-comic/plugin/vite`

版本升级后，应优先以 [`packages/plugin/lib/api`](packages/plugin/lib/api)、[`PluginManifest`](packages/model/lib/model/plugin.ts) 和 [`packages/plugin/ARCHITECTURE.md`](packages/plugin/ARCHITECTURE.md) 为准。

## 1. 先理解新的插件范式

插件不再注册 loader、booter，也不应修改宿主的全局注册表。插件只需要导出一份声明式配置，宿主负责发现、排序、激活和回滚：

```text
manifest
   ↓
PluginCandidate
   ↓
依赖规划
   ↓
default factory(ConfigEnv)
   ↓
DCPluginConfig
   ↓
config → i18n → model → content → user → resource
       → remote → auth → special → lifecycle
   ↓
PluginScope 统一管理卸载和失败回滚
```

内部插件与安装插件进入运行时以后使用完全相同的协议。第三方插件不需要、也不应该判断自己的来源。

插件作者需要维护的只有两份核心数据：

1. `PluginManifest`：身份、版本、依赖、入口和兼容范围。
2. `DCPluginConfig`：插件希望向宿主贡献的配置、翻译、模型和钩子。

## 2. 五分钟创建最小插件

### 2.1 项目结构

```text
delta-comic-plugin-example/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts
    └── manifest.ts
```

### 2.2 安装依赖

`@delta-comic/plugin` 的版本最好与目标客户端保持一致。使用预发布客户端时，建议精确锁定版本。

```sh
vp add -E @delta-comic/plugin@3.0.0-next.9
vp add -D vite-plus typescript
```

只有实际使用宿主模型或 UI 时，才需要添加对应依赖，例如：

```sh
vp add -E @delta-comic/model@3.0.0-next.9 @delta-comic/ui@3.0.0-next.9
vp add vue naive-ui
```

最小 `package.json`：

```json
{
  "name": "@example/delta-comic-plugin-example",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vp dev",
    "build": "vp build",
    "check": "vp check",
    "test": "vp test"
  },
  "dependencies": {
    "@delta-comic/plugin": "3.0.0-next.9"
  },
  "devDependencies": {
    "typescript": "^6.0.0",
    "vite-plus": "^0.2.7"
  }
}
```

### 2.3 TypeScript 配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts"]
}
```

### 2.4 编写 manifest

创建 `src/manifest.ts`：

```ts
import {
  DELTA_COMIC_PLUGIN_API_VERSION,
  type PluginManifest,
} from '@delta-comic/plugin'

export const manifest = {
  apiVersion: DELTA_COMIC_PLUGIN_API_VERSION,
  name: {
    id: 'example-plugin',
    display: '示例插件',
  },
  version: {
    plugin: '0.1.0',
    supportCore: '>=3.0.0-next.9 <4.0.0',
  },
  author: 'Your Name',
  description: '一个最小的 Delta Comic 插件',
  require: [],
  entry: {
    jsPath: 'index.mjs',
  },
  kind: 'normal',
} satisfies PluginManifest
```

### 2.5 编写插件入口

创建 `src/main.ts`：

```ts
import { defineDeltaComicPlugin } from '@delta-comic/plugin'

import { manifest } from './manifest'

export default defineDeltaComicPlugin(env => ({
  // 必须与 manifest.name.id 完全一致。
  name: manifest.name.id,

  hooks: {
    onBooted() {
      console.info('[example-plugin] loaded', {
        platform: env.platform,
        safeStartup: env.safe,
      })
    },
    onUnload() {
      console.info('[example-plugin] unloaded')
    },
  },
}))
```

入口模块必须 `default export` 一个 `PluginConfigFactory`。不要默认导出普通对象、Promise 或 Vue 组件。

`ConfigEnv` 当前包含：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `platform` | `'tauri' \| 'web'` | 当前运行平台 |
| `safe` | `boolean` | 用户本次是否选择安全启动配置；它不是安全沙箱 |

Factory 应保持纯净：只根据环境组装并返回配置，不要在模块顶层或 Factory 中注册监听器、启动定时器或修改 DOM。副作用应放进生命周期钩子。

### 2.6 配置 Vite+

创建 `vite.config.ts`：

```ts
import { deltaComic } from '@delta-comic/plugin/vite'
import { defineConfig } from 'vite-plus'

import { manifest } from './src/manifest'

export default defineConfig(({ command }) => ({
  plugins: deltaComic(manifest, command),
}))
```

如果插件包含 Vue SFC，应额外安装并启用 Vue 插件：

```sh
vp add -D @vitejs/plugin-vue
```

```ts
import vue from '@vitejs/plugin-vue'
import { deltaComic } from '@delta-comic/plugin/vite'
import { defineConfig } from 'vite-plus'

import { manifest } from './src/manifest'

export default defineConfig(({ command }) => ({
  plugins: [vue(), ...deltaComic(manifest, command)],
}))
```

### 2.7 构建和安装

```sh
vp install
vp check
vp build
```

构建完成后，`dist` 中会生成：

- `plugin.zip`：供客户端安装的完整插件包。
- `manifest.json`：供 GitHub Release 和插件市场提前检查的独立 manifest。

在 Delta Comic 的“插件 → 安装”页面选择 `plugin.zip`，随后启动普通插件即可验证最小示例。

## 3. Manifest 完整参考

```ts
interface PluginManifest {
  apiVersion: 1
  name: { id: string; display: string }
  version: { plugin: string; supportCore: string }
  author: string
  description: string
  icon?: string
  require: { id: string; download?: string }[]
  entry?: { jsPath: string; cssPath?: string }
  kind?: 'normal' | 'preboot'
  integrity?: { algorithm: 'blake3' | 'sha256'; digest: string }
}
```

| 字段 | 规则 |
| --- | --- |
| `apiVersion` | 必须等于宿主导出的 `DELTA_COMIC_PLUGIN_API_VERSION`，当前为 `1` |
| `name.id` | 稳定主键，1–64 字符；首字符为字母或数字，其余可使用字母、数字、`.`、`_`、`-` |
| `name.display` | 用户可见名称，不能为空 |
| `version.plugin` | 插件版本；应使用合法 SemVer |
| `version.supportCore` | 宿主版本的 SemVer range；安装和 GitHub 来源解析都会检查 |
| `author`、`description` | 非空文本 |
| `icon` | 插件包内相对路径，或无用户名、密码的 HTTP(S) URL |
| `require` | 插件依赖；依赖会先激活，缺失、循环或激活失败会阻止当前插件 |
| `entry.jsPath` | 包内 ESM 入口；省略时默认为 `index.mjs` |
| `entry.cssPath` | 可选 CSS 文件；激活时注入，卸载时自动移除 |
| `kind` | 省略时为 `normal`；绝大多数第三方插件都应使用 `normal` |
| `integrity` | 安装器会根据实际包内容生成 SHA-256 完整性信息，普通作者无需手写 |

路径必须是安全相对路径，不能是绝对路径、盘符路径，不能包含 `..` 或空字符。

`require[].download` 目前只作为依赖下载提示保存，运行时依赖规划只读取 `id`，不会自动安装缺失依赖。

## 4. DCPluginConfig：插件真正贡献的内容

Factory 返回值的结构如下：

```ts
interface DCPluginConfig {
  name: string
  config?: ConfigPointer
  i18n?: PluginLocaleMessages
  model?: PluginConfigModel
  hooks?: PluginConfigHooks
}
```

所有字段都是声明式贡献。宿主会按固定顺序解释它们，插件不需要自行调用注册 API。

### 4.1 配置表单

一个插件最多注册一个 `ConfigPointer`，其 `pluginName` 必须与插件 ID 一致。

```ts
// src/settings.ts
import { ConfigPointer } from '@delta-comic/plugin'

import { manifest } from './manifest'

export const settings = new ConfigPointer(
  manifest.name.id,
  {
    endpoint: {
      type: 'string',
      defaultValue: 'https://api.example.com',
      info: 'example.config.endpoint',
      placeholder: 'https://api.example.com',
      required: true,
    },
    pageSize: {
      type: 'number',
      defaultValue: 20,
      info: 'example.config.pageSize',
      range: [1, 100],
      float: false,
    },
    enableExperimental: {
      type: 'switch',
      defaultValue: false,
      info: 'example.config.experimental',
    },
  },
  'example.config.title',
)
```

在插件配置中引用：

```ts
import { defineDeltaComicPlugin, useConfig } from '@delta-comic/plugin'

import { manifest } from './manifest'
import { settings } from './settings'

export default defineDeltaComicPlugin(() => ({
  name: manifest.name.id,
  config: settings,
  hooks: {
    onBooted() {
      const config = useConfig().load(settings)
      console.info(config.data.value.endpoint)
    },
  },
}))
```

不要在模块顶层执行 `useConfig().load(settings)`：此时插件还没有进入 config capability，读取会失败。在 `onBooted`、模型回调或用户操作回调中读取是安全的。

支持的表单类型：

| `type` | 默认值类型 | 主要选项 |
| --- | --- | --- |
| `string` | `string` | `placeholder`、`required`、`patten` |
| `number` | `number` | `range`、`float` |
| `radio` | `string` | `selects`、`comp: 'radio' \| 'select'` |
| `checkbox` | `string[]` | `selects`、`comp: 'checkbox' \| 'multipleSelect'` |
| `switch` | `boolean` | `open`、`close` |
| `date` | `string` | `format`、`time` |
| `dateRange` | `[string, string]` | `format`、`time` |
| `pairs` | `{ key: string; value: string }[]` | `noMultiple` |

`ConfigPointer` 要求每个字段都有 `defaultValue`。`patten` 是当前公共 API 中的历史拼写，使用时必须按此拼写。

### 4.2 国际化

插件消息按 locale 注册，并与宿主消息合并。键名处于全局命名空间，必须使用插件 ID 或组织名作为前缀。

```ts
import type { PluginLocaleMessages } from '@delta-comic/plugin'

export const messages = {
  'zh-CN': {
    example: {
      config: {
        title: '示例插件',
        endpoint: '接口地址',
        pageSize: '每页数量',
        experimental: '启用实验功能',
      },
    },
  },
  'en-US': {
    example: {
      config: {
        title: 'Example plugin',
        endpoint: 'API endpoint',
        pageSize: 'Page size',
        experimental: 'Enable experimental features',
      },
    },
  },
} satisfies PluginLocaleMessages
```

```ts
export default defineDeltaComicPlugin(() => ({
  name: manifest.name.id,
  config: settings,
  i18n: messages,
}))
```

配置表单的 `info`、`placeholder`、`selects[].label` 和表单标题直接填写普通 i18n key，例如 `example.config.endpoint`。

对于明确支持插件文本协议的宿主字段，可以使用 `pluginMessageKey('example.someKey')`；在插件自己的运行时回调中，可以调用 `pluginI18n.translate('example.someKey')`。不要假设所有任意字符串都会自动翻译。

## 5. 模型能力参考

`model` 是插件业务能力的主要入口：

```ts
interface PluginConfigModel {
  content?: ContentModel
  resource?: ResourceModel
  remotes?: RemoteModel
  user?: UserModel
  social?: SocialModel
  special?: SpecialModel
  expose?: Record<string, unknown>
}
```

### 5.1 Content

`content` 包含三组能力：

| 字段 | 用途 |
| --- | --- |
| `models` | 注册内容类型及其卡片、详情页、布局、评论、下载和数据转换实现 |
| `search` | 搜索方法、排序、自动补全、条码规则和热搜提供器 |
| `promotes` | 首页 Tab、分类、榜单、热门按钮和随机内容 |

每个 `Content.Model.name` 在同一插件内必须唯一。宿主使用 `[pluginId, modelName]` 作为来源键，插件无需修改 `UniItem`、`UniContentPage` 等全局表。

分页查询使用 `StreamQuery`：

```ts
import { StreamQuery } from '@delta-comic/model'

const search = new StreamQuery(
  async ({ aim }, page, signal) => {
    const response = await fetch(
      `https://api.example.com/search?q=${encodeURIComponent(aim.input)}&page=${page}`,
      { signal },
    )
    if (!response.ok) throw new Error(`search failed: ${response.status}`)

    return {
      data: [], // UniItem[]
      nextPage: Number(page) + 1,
    }
  },
  1,
)
```

所有接收 `AbortSignal` 的 provider 都必须把 signal 继续传给 `fetch` 或下游任务，并在取消后停止写入状态。

完整类型定义见 [`content.ts`](packages/plugin/lib/api/model/content.ts)。

### 5.2 Resource

`resource.types` 定义资源类型及候选根地址；激活时宿主并行探测地址，首个成功地址成为优先来源。没有可用地址会导致插件激活失败。

```ts
model: {
  resource: {
    types: [
      {
        type: 'image',
        urls: ['https://cdn-a.example.com', 'https://cdn-b.example.com'],
        async test(url, signal) {
          const response = await fetch(`${url}/health`, { signal })
          if (!response.ok) throw new Error(`unreachable: ${url}`)
        },
      },
    ],
    process: {
      signed: async pathname => [`${pathname}?token=example`, false],
    },
  },
}
```

同一插件内的资源 `type` 必须唯一。完整类型见 [`resource.ts`](packages/plugin/lib/api/model/resource.ts)。

### 5.3 Remote

`remotes` 用于从一组等价服务端点中选择首个可用端点。每个 group 名称必须唯一。

```ts
import type { Remote } from '@delta-comic/plugin'

let selectedApi: Remote.Definition | false = false

const apiRemotes: Remote.TestGroup = {
  name: 'main-api',
  remotes: [
    { name: 'primary', url: 'https://api.example.com' },
    { name: 'backup', url: 'https://backup.example.com' },
  ],
  async test(url, signal) {
    const response = await fetch(`${url}/health`, { signal })
    if (!response.ok) throw new Error(`unreachable: ${url}`)
  },
}

export default defineDeltaComicPlugin(() => ({
  name: manifest.name.id,
  model: { remotes: [apiRemotes] },
  hooks: {
    onRemoteTestDone(group, remote) {
      if (group.name === 'main-api') selectedApi = remote
    },
  },
}))
```

默认情况下没有可用端点会让插件激活失败；确实允许离线时设置 `allowNoConnected: true`。

### 5.4 User

`user` 用于声明：

- 登录方式和默认鉴权策略；
- 用户卡片与编辑组件；
- 用户操作及操作页面；
- 收藏上传和下载。

只要声明 `user`，`auth` 和 `favourites` 就是必填项。鉴权只能在 normal 插件激活阶段使用，preboot 插件声明鉴权会被拒绝。

完整类型见 [`user.ts`](packages/plugin/lib/api/model/user.ts)。

### 5.5 Social

`social.share` 可以贡献主动分享动作和剪贴板口令监听器；`social.subscribe` 可以贡献订阅更新检查和作者内容分页查询。

```ts
model: {
  social: {
    share: {
      initiative: [
        {
          key: 'copy-id',
          name: '复制内容标识',
          icon: {},
          filter: page => Boolean(page.preload),
          async call(page) {
            return { token: `${page.plugin}:${page.id}:${page.ep}` }
          },
        },
      ],
    },
  },
}
```

完整类型见 [`social.ts`](packages/plugin/lib/api/model/social.ts)。

### 5.6 Special 与 Expose

`special` 是串行启动步骤，可更新加载说明：

```ts
model: {
  special: [
    {
      name: 'prepare-cache',
      async call(setDescription) {
        setDescription('warming up')
        await prepareCache()
      },
    },
  ],
}
```

步骤抛错会使当前插件激活失败并触发回滚。不要用 `special` 模拟第二套 booter 系统；它只适合该插件自身的有限准备工作。

`expose` 可提供任意具名能力，但只有存在明确宿主或其他插件消费者时才应使用。跨插件共享优先设计稳定、窄小的类型契约，不要暴露整个内部 service 实例。

## 6. 生命周期与回滚

| 钩子 | 调用时机 | 注意事项 |
| --- | --- | --- |
| `onPreboot({ app })` | preboot 插件在 Vue `mount` 前 | 可调用 `app.use()`；返回值会作为 cleanup 注册 |
| `onBooted()` | normal 插件全部能力成功注册后 | 适合启动插件自己的监听、缓存或轻量任务 |
| `onUnload()` | normal 插件重载、禁用或运行时释放时 | 必须幂等；清除事件、定时器、连接和临时状态 |
| `onUninstall()` | 未激活插件的文件永久删除前 | 用于清除插件拥有的持久数据；也应保持幂等 |

普通插件示例：

```ts
export default defineDeltaComicPlugin(() => {
  let timer: ReturnType<typeof setInterval> | undefined

  return {
    name: manifest.name.id,
    hooks: {
      onBooted() {
        timer = setInterval(() => void refresh(), 60_000)
      },
      onUnload() {
        if (timer) clearInterval(timer)
        timer = undefined
      },
    },
  }
})
```

preboot 插件示例：

```ts
// manifest.kind 必须是 'preboot'
export default defineDeltaComicPlugin(() => ({
  name: manifest.name.id,
  hooks: {
    onPreboot({ app }) {
      app.use(MyVuePlugin)

      const controller = new AbortController()
      window.addEventListener('example', handleExample, { signal: controller.signal })
      return () => controller.abort()
    },
  },
}))
```

宿主自动回滚配置、i18n、贡献模型、内容注册项、资源注册项、CSS 和模块 URL。插件自行创建的副作用仍必须通过 cleanup 或 `onUnload` 清理。

当前版本有一项卸载限制：如果插件仍处于激活状态，运行时会执行 `onUnload` 后直接删除插件，不会再调用 `onUninstall`。需要清除持久数据时，不要把唯一的关键清理逻辑只放在 `onUninstall`；卸载前应先禁用插件并让 normal 插件完成重载。

能力按固定顺序串行激活，所以 Factory 和声明式模型应保持无副作用。不要依赖未写入公共契约的内部执行细节。

## 7. 插件依赖

```ts
require: [
  { id: 'base-plugin', download: 'gh:example/base-plugin' },
]
```

运行时保证：

- 依赖先于当前插件激活；
- 缺失依赖会报告 `missing`；
- 循环依赖会报告完整环；
- 依赖激活失败后，依赖它的插件不会继续激活；
- 卸载时按激活顺序的逆序释放。

插件代码不能假设另一个插件只因安装就已经 ready。跨插件读取应发生在自身激活完成后的回调中，并处理对方缺失或禁用的情况。

## 8. 共享依赖与宿主 ABI

插件与宿主必须复用同一份 Vue、Pinia、模型和数据库实例。构建插件会把以下精确模块 ID 改写为宿主提供的对象：

```text
vue
naive-ui
vue-router
vue-router/experimental
pinia
@pinia/colada
@delta-comic/ui
@delta-comic/model
@delta-comic/plugin
@delta-comic/utils
@delta-comic/db
```

必须从公开根入口导入：

```ts
import { computed } from 'vue'
import { UniItem } from '@delta-comic/model'
import { defineDeltaComicPlugin } from '@delta-comic/plugin'
```

以下写法会在构建时被拒绝，因为它可能创建第二份运行时或绕开公共 API：

```ts
import { reactive } from 'vue/dist/vue.esm-bundler.js'
import type { Component } from '@vue/runtime-core'
import { something } from '@delta-comic/plugin/lib/internal-file'
```

列表以外的第三方依赖会被打进插件包。应控制体积，并确认依赖能够在目标 WebView 中运行。

不要直接读写 `window.$$lib$$`；它是构建器和宿主之间的 ABI，不是插件作者 API。

## 9. 开发、安装和更新来源

客户端当前支持以下安装输入：

| 输入 | 示例 | 行为 |
| --- | --- | --- |
| 本地文件 | 在 UI 中选择 `plugin.zip` | 直接读取本地包 |
| HTTP(S) | `https://example.com/plugin.zip` | 下载后按 ZIP 解码 |
| GitHub | `gh:owner/repository` | 查找最新的兼容稳定 Release |
| 插件市场 | `ap:plugin-id` | 从 Catalog 定位真实 GitHub 或 HTTP 来源 |
| 开发脚本 | `.js`、`.mjs`、`.user.js` | 从 `@description` 读取 manifest，仅用于开发 |

### 9.1 开发服务器

```sh
vp dev
```

serve 模式使用 userscript 开发入口，并把 manifest 写入 `@description`。根据终端显示的开发地址安装生成的脚本，可以快速验证代码；正式分发仍应使用 `plugin.zip`。

### 9.2 GitHub Release

`gh:owner/repository` 安装方式只接受非 draft、非 prerelease 的 Release，并要求 Release 同时包含以下两个精确文件名：

- `plugin.zip`
- `manifest.json`

解析器会先读取 `manifest.json`，跳过与当前宿主不兼容的版本，再下载同一 Release 中的 `plugin.zip`。

发布前至少执行：

```sh
vp check
vp test
vp build
```

确保 Git tag、`package.json`、`manifest.version.plugin` 和 Release 版本保持一致。

## 10. 测试建议

Factory 本身可以直接做单元测试：

创建 `test/src/main.test.ts`：

```ts
import { describe, expect, it } from 'vite-plus/test'

import createPlugin from '../../src/main'
import { manifest } from '../../src/manifest'

describe('plugin contract', () => {
  it('returns a config with the manifest owner', () => {
    const config = createPlugin({ platform: 'web', safe: true })

    expect(config.name).toBe(manifest.name.id)
  })
})
```

建议把测试集中在真正的使用边界：

- manifest ID 与 `config.name` 一致；
- 每个 provider 正确转发并响应 `AbortSignal`；
- 分页的 `nextPage`、`lastPage` 正确；
- 网络失败、空数据和非法数据可预期；
- lifecycle cleanup 可以重复调用；
- 配置默认值足以让插件首次启动；
- `vp build` 后 ZIP 内存在 manifest 声明的入口、CSS 和图标。

检查构建产物：

```sh
unzip -l dist/plugin.zip
```

## 11. 常见错误

### `plugin entry has no default factory`

入口没有默认导出 `defineDeltaComicPlugin(...)` 的返回值，或 manifest 指向了错误文件。

### `plugin name mismatch`

`DCPluginConfig.name` 与 `manifest.name.id` 不一致。两者应引用同一个常量。

### `plugin config owner mismatch`

`new ConfigPointer(pluginName, ...)` 的 `pluginName` 不是当前插件 ID。

### `plugin can only register one config`

同一个插件声明了多个 `ConfigPointer`。合并为一个配置描述对象。

### `missing` 或 `cycles`

`manifest.require` 中存在未安装依赖或循环。不要用依赖顺序隐式传递状态。

### `no reachable endpoint`

Remote 或 Resource 的所有测试都失败或超时。测试函数应在成功时正常返回，在失败时抛错，并转发 `AbortSignal`。

### `Shared runtime subpath is not supported`

导入了 Vue 或宿主库的内部子路径。改为从错误信息提示的公开入口导入。

### CSS 没有加载

如果构建产生 `index.css`，manifest 必须声明：

```ts
entry: { jsPath: 'index.mjs', cssPath: 'index.css' }
```

如果没有 CSS 产物，不要填写 `cssPath`，否则激活时会因为文件不存在而失败。

## 12. 安全边界

第三方插件在应用上下文中执行代码，目前不是隔离沙箱。插件作者和用户都应遵守以下原则：

- 只安装和发布可审计来源的插件；
- 不读取与插件功能无关的数据库、Cookie、文件或设备信息；
- 不在日志中输出 token、Cookie 和用户内容；
- 所有 URL、远端 JSON 和剪贴板输入都按不可信数据处理；
- 对网络请求设置取消、超时和状态码检查；
- 不把 `env.safe` 当作权限或信任证明；
- 卸载不应删除不属于当前插件的数据。

## 13. 仓库内部插件

如果是在 Delta Comic 主仓库中增加内置插件，不需要修改 composition 或运行时。新增一个 `packages/plugin/lib/builtins/*.builtin.ts` 文件并默认导出定义即可：

```ts
import { DELTA_COMIC_PLUGIN_API_VERSION, defineDeltaComicPlugin } from '../api'
import { defineInternalPlugin } from '../kernel'

const factory = defineDeltaComicPlugin(() => ({ name: 'example-builtin' }))

export default defineInternalPlugin({
  factory,
  manifest: {
    apiVersion: DELTA_COMIC_PLUGIN_API_VERSION,
    author: 'Delta Comic',
    description: 'Example built-in plugin',
    name: { id: 'example-builtin', display: 'Example Built-in' },
    require: [],
    version: { plugin: '1.0.0', supportCore: '*' },
  },
})
```

`builtins/index.ts` 会通过文件系统 glob 自动发现它。内置插件仍然使用相同的 manifest、Factory、能力流水线和作用域回滚规则。

## 14. 发布前检查表

- [ ] `manifest.name.id` 稳定、可移植，并与 `config.name` 一致。
- [ ] `apiVersion` 使用宿主常量，没有手写过期值。
- [ ] `supportCore` 明确覆盖已测试客户端版本。
- [ ] 所有 manifest 路径均为安全相对路径。
- [ ] Factory 无副作用，副作用有对应 cleanup。
- [ ] 所有异步 provider 转发并响应 `AbortSignal`。
- [ ] 配置字段均有可工作的 `defaultValue`。
- [ ] i18n key 带插件命名空间，不覆盖宿主键。
- [ ] 没有导入共享库内部子路径或访问 `window.$$lib$$`。
- [ ] `vp check`、`vp test`、`vp build` 通过。
- [ ] `plugin.zip` 内包含 manifest 声明的全部文件。
- [ ] GitHub Release 同时上传 `plugin.zip` 和 `manifest.json`。
- [ ] 已说明插件使用的网络、鉴权、存储和隐私行为。

## 15. 源码索引

- 插件作者公共 API：[`packages/plugin/lib/api`](packages/plugin/lib/api)
- Manifest 定义：[`packages/model/lib/model/plugin.ts`](packages/model/lib/model/plugin.ts)
- Manifest 校验：[`packages/plugin/lib/install/manifest.ts`](packages/plugin/lib/install/manifest.ts)
- Vite 构建插件：[`packages/plugin/vite/index.ts`](packages/plugin/vite/index.ts)
- 默认能力顺序：[`packages/plugin/lib/capabilities/index.ts`](packages/plugin/lib/capabilities/index.ts)
- 运行时与回滚：[`packages/plugin/lib/runtime/engine.ts`](packages/plugin/lib/runtime/engine.ts)
- 架构边界：[`packages/plugin/ARCHITECTURE.md`](packages/plugin/ARCHITECTURE.md)
