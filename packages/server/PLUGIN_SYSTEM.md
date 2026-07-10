# Delta Comic Server 插件系统

server 插件系统借鉴 app 端的 manifest、文件驱动发现、依赖拓扑和阶段化生命周期，按 Cloudflare
Workers 的部署模型重新实现。它不会在核心 Worker 中执行上传的 JavaScript，也不会使用 `eval`。

## 运行模型

- `StaticPluginExecutor` 通过 `app/modules/plugins/definitions/index.ts` 的普通 ESM 索引收集定义；它兼容 Wrangler 的 Worker 打包链路，也让可执行插件清单保持可审计。
- D1 保存注册目录、安装版本、期望/观测状态、配置、最近健康、任务与审计。
- 管理员在 server-admin 中完成注册、安装、更新、启停、配置、健康检查和卸载。
- 插件只能获得 `ServerPluginHost` 暴露的低基数只读能力；不会得到完整 `Env`、secret 或 D1 binding。
- `ServerPluginExecutor` 是稳定边界。未来若启用 Cloudflare Dynamic Workers，可增加隔离执行器，而不改变控制面 API。

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

## 本地运行

```bash
vp run --filter @delta-comic/server migrate:local
vp run --filter @delta-comic/server dev
vp run --filter @delta-comic/server-admin dev
```

远端部署前显式执行 `migrate:remote`。`deploy` 不会自动修改生产数据库。
