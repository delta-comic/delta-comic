# Delta Comic Server 插件系统

server 插件系统借鉴 app 端的 manifest、文件驱动发现、依赖拓扑和阶段化生命周期，按 Cloudflare
Workers 的部署模型重新实现。核心 Worker 不使用 `eval`；管理员为已安装插件配置的代码由
Cloudflare Dynamic Worker Loader 放进独立 isolate 执行。

## 运行模型

- `StaticPluginExecutor` 通过 `app/modules/plugins/definitions/index.ts` 的普通 ESM 索引收集定义；它兼容 Wrangler 的 Worker 打包链路，也让可执行插件清单保持可审计。
- D1 保存注册目录、安装版本、期望/观测状态、配置、最近健康、任务与审计。
- 管理员在 server-admin 中完成注册、安装、更新、启停、配置、健康检查和卸载。
- 静态插件只能获得 `ServerPluginHost` 暴露的低基数只读能力；不会得到完整 `Env`、secret 或 D1 binding。
- `ServerPluginExecutor` 管理随部署发布、可审计的静态生命周期代码。
- `DynamicWorkerPluginRunner` 管理管理员配置的运行期脚本：Dynamic Worker 继承父 Worker 的公网访问，
  并通过 RPC binding 获得完整 SQL 读写能力；仍限制为 50ms CPU，输入输出只通过 JSON 传递。
- D1 另外保存脚本、下次运行时间和每次执行结果；脚本随插件卸载级联删除。

## 编写内置插件

在 `app/modules/plugins/definitions` 新建一个默认导出的定义：

```ts
import { defineServerPlugin } from '../../../../lib/plugin'

export default defineServerPlugin({
  manifest: {
    apiVersion: 1,
    id: 'example.health',
    name: '示例健康插件',
    version: '1.0.0',
    author: 'Delta Comic',
    description: '演示受控健康检查。',
    dependencies: [{ id: 'core.diagnostics', versionRange: '^1.0.0' }],
    capabilities: ['health.read'],
    configSchema: {
      properties: {
        enabled: { type: 'boolean', label: '启用检查', defaultValue: true },
      },
    },
  },
  runtime: {
    async health({ config, host }) {
      const databaseReady = await host.probeDatabase()
      return {
        status: databaseReady && config.enabled ? 'healthy' : 'degraded',
        message: databaseReady ? 'D1 可用' : 'D1 不可用',
        observedAt: Date.now(),
      }
    },
  },
})
```

manifest 在 Worker 启动时做运行时校验：插件 ID、语义版本、依赖版本范围、重复依赖、配置类型与范围都会被检查。当前版本拒绝 `secret: true` 的配置字段；敏感值必须由 Worker secret 和后续的受控 capability 提供，不能明文写入 D1。

## 生命周期与状态

```text
available → registered → installed/disabled → enabled
                         ↘ failed
```

- 安装会递归解析依赖并按拓扑顺序执行。
- 启用插件时会先安装并启用依赖。
- 存在已启用依赖方时不能停用 provider；存在已安装依赖方时不能卸载 provider。
- 更新会比较 D1 中的 `installedVersion` 与当前构建所带版本。
- 所有动作都会生成持久化 Job 和审计记录；失败动作保留错误并避免伪装成成功状态。
- 健康检查结果写入 installation，可由管理面板读取最近状态。

## 管理 API

所有接口都位于 `/api/admin`，使用独立的 `SERVER_ADMIN_TOKEN` Bearer token：

- `GET /capabilities`：运行模块、binding、配置限制和功能握手。
- `GET /health/ready`：D1 与必需 secret 就绪检查。
- `GET /overview`：真实 D1 计数、部署版本和插件活动。
- `GET /plugins`：插件控制面快照。
- `POST /plugins/:id/register|install|enable|disable|update|health`。
- `PATCH /plugins/:id/config`。
- `DELETE /plugins/:id`。
- `GET /plugins/jobs/:jobId`。
- `GET|PUT /plugins/:id/script`：读取或配置隔离脚本、启用状态和 1–168 小时周期。
- `POST /plugins/:id/script/run`：立即执行一次，可传入 JSON `input`。
- `GET /plugins/:id/script/runs`：读取最近执行记录。

脚本正文作为异步函数体运行，可读取 `input` 与只读的 `context`，使用全局 `fetch()` 访问公网，通过
`database`（别名 `db`）访问 D1，并用 `return` 返回 JSON 值。数据库接口兼容
`prepare().bind().all()/first()/run()/raw()`，另提供 `batch()`、`exec()` 和 `dump()`：

```js
const response = await fetch(input.url)
const page = await response.text()
await database.exec(
  'CREATE TABLE IF NOT EXISTS plugin_cache (plugin_id TEXT PRIMARY KEY, body TEXT NOT NULL)',
)
await database
  .prepare('INSERT INTO plugin_cache (plugin_id, body) VALUES (?, ?)')
  .bind(context.pluginId, page)
  .run()
return { bytes: page.length, trigger: context.trigger }
```

此能力等同于信任脚本可以读写整个服务数据库并向任意公网目标发送请求；只有通过管理员鉴权的脚本配置接口
可以写入或执行这类代码，Worker secret 仍不会注入动态 Worker。

Worker 的 Cron Trigger 配置为 `0 * * * *`（UTC 每小时整点）。每次触发会读取已到期脚本，
以 `scheduled` trigger 执行并根据各脚本的 `intervalHours` 推进下一次运行时间。Cron 只负责
唤醒调度器，因此脚本周期的最小粒度是一小时。

## 本地运行

```bash
vp run --filter @delta-comic/server migrate:local
vp run --filter @delta-comic/server dev
vp run --filter @delta-comic/server-admin dev
```

远端部署前显式执行 `migrate:remote`。`deploy` 不会自动修改生产数据库。
