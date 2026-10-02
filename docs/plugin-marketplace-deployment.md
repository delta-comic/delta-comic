# 插件市场目录部署

本文记录当前插件市场目录边界的部署操作。目录由 Worker 通过可选的 R2 binding 提供，公开读取目录与受保护的发布、撤回操作共用 `SERVER_ADMIN_TOKEN`。

## R2 bucket

创建部署环境对应的 bucket：

```sh
vp exec wrangler r2 bucket create delta-comic-plugin-catalog
```

在 `packages/server/core/server/wrangler.jsonc` 的 `r2_buckets` 中添加 binding：

```jsonc
{
  "r2_buckets": [
    {
      "binding": "PLUGIN_CATALOG",
      "bucket_name": "delta-comic-plugin-catalog"
    }
  ]
}
```

本地开发使用本地 R2 模拟存储。需要连接远程 bucket 时，在 binding 中增加 `remote: true`，并确认当前 Wrangler 登录账号拥有目标 bucket 权限。

## 管理密钥

为每个部署环境分别写入管理员密钥：

```sh
vp exec wrangler secret put SERVER_ADMIN_TOKEN
```

发布端点要求：

- `POST /plugins/catalog/releases`
- `POST /plugins/catalog/releases/yank`

请求必须携带 `Authorization: Bearer <SERVER_ADMIN_TOKEN>`。目录读取 `GET /plugins/catalog/index.json` 保持公开。目录直接写入 `PUT /plugins/catalog/index.json` 也使用相同授权。

## 部署与检查

在仓库根目录执行。部署使用 Vite 生成的 Worker 配置，确保路径别名已经在构建阶段解析：

```sh
vp run --filter @delta-comic/server build
vp run --filter @delta-comic/server migrate:remote
vp -C packages/server/core/server exec wrangler deploy --config dist/delta_comic_server/wrangler.json
```

当前服务端采用单 Worker 和共享 D1。目录发布、认证、同步与 JSON 流程由同一 Worker 提供。
每次流程执行创建原生 Cordis Context，注入认证租户身份和宿主操作，完成后释放。

当前测试部署使用免费 D1 `delta-comic-server-db`，远程迁移已执行完成。部署后的健康检查：

```text
GET https://delta-comic-server.wenxig.workers.dev/api/health/live -> 200
GET https://delta-comic-server.wenxig.workers.dev/plugins/catalog/index.json -> 404
POST https://delta-comic-server.wenxig.workers.dev/plugins/catalog/releases -> 404
```

测试部署没有配置 `PLUGIN_CATALOG` R2 binding，因此目录路径返回 404；启用 binding 后会自动打开
目录、发布和撤回端点。

## 产物上传与诊断

配置 `PLUGIN_ARTIFACTS` R2 binding 和 `PLUGIN_PUBLIC_BASE_URL` 后，管理员可以向
`POST /plugins/catalog/artifacts` 上传预构建 ZIP。请求需要 `SERVER_ADMIN_TOKEN`，并携带
`x-plugin-id`、`x-plugin-version`、`x-plugin-platform` 和 `content-type` 请求头。Worker 会计算
SHA-256 integrity，写入 `artifacts/{pluginId}/{version}/{platform}.zip`，返回可放入目录 release
的 artifact 元数据和 `x-publisher-id`。

管理员可以通过 `GET /api/admin/diagnostics` 读取 Worker 诊断快照；向同一路径 POST 已导出的
diagnostic archive 可执行注册的回放处理器。接口复用容量上限和 Bearer 管理员鉴权。

部署后检查公开目录：

```sh
curl -i https://<worker-host>/plugins/catalog/index.json
```

检查发布授权：

```sh
curl -i \
  -H "Authorization: Bearer <SERVER_ADMIN_TOKEN>" \
  -H 'Content-Type: application/json' \
  -X POST \
  https://<worker-host>/plugins/catalog/releases \
  --data-binary @release-payload.json
```

发布器会校验 HTTPS artifact URL、Manifest URL、平台、完整性值、版本和目录条目。artifact 上传使用
R2 `If-None-Match: *`，已存在的版本返回 409。授权回调返回的发布者 ID 会写入
`x-publisher-id` 响应头；产物完整性使用 Manifest 声明的 SHA-256。

## 变更操作

目录索引由 R2 object `catalog/index.json` 保存。发布和撤回请求会读取当前目录、携带对象的 HTTP ETag，并通过 R2 `If-Match` 条件写入完成一次领域变更；首次创建使用 `If-None-Match: *`。R2 条件失败会返回 409，调用方应重新读取目录后重试。生产环境变更前应保存当前 object，发布后检查目录中的 `generatedAt`、插件 ID 和版本。

目录 GET 响应包含 ETag，直接 PUT 可使用 `If-Match` 或 `If-None-Match: *`；陈旧条件返回 412。发布端点在目录冲突时返回 409，发布者可重新载入并重试。R2 写入具备强一致性，条件写入由对象存储原子执行。

## 租户 JSON 流程

`@delta-comic/server` 提供 JSON 流程 schema、类型与 Cordis Context 扩展，云客户端入口为
`@delta-comic/server/api`。流程安装与执行通过 `/api/plugins` 接口接受用户 access token；
`auth.userId` 确定租户。管理端插件页面分别保存用户 token 与运营管理 token。

manifest 使用协议 v2，`server.entry` 指向资源清单中的 JSON 文件。在线安装提交 manifest、
流程源码、配置、启用与可选间隔任务设置，宿主校验 schema、表达式和 SHA-256 后保存。
下一次调用读取已保存流程。流程操作为 `if`、`http`、`store.get`、`store.set`、`store.delete`
和 `return`，参数表达式使用显式 `{ expr: JsonLogic }`。

安装、定时、执行记录和键值分别保存在共享 D1 的 `server_plugin_packages`、
`server_plugin_schedules`、`server_plugin_runs`、`server_plugin_store`。
租户与插件复合键限定数据访问；定时任务由 D1 原子领取并推进下次执行时间。
远程部署前应用全部迁移，包括 `0005_plugin_flows.sql` 与 `0006_remove_legacy_plugin_tables.sql`。

每次执行限制为 64 步、分支深度 16、HTTP 16 次，每次 HTTP timeout 为 10 秒。
免费计划的 CPU、D1 与 subrequest 约束及实际资源测量见 `docs/plugin-flow-acceptance.md`。
`.github/workflows/server-deploy.yaml` 会依次执行 workspace 构建、格式与类型检查、测试、codegen
检查、远程迁移、Worker 部署和可选的 admin Pages 部署。

admin 的运行指标页面包含 Worker 诊断快照入口；发布者账户由部署环境的授权回调提供，
凭证轮换通过 `SERVER_ADMIN_TOKEN` secret 完成。生产变更按目录 ETag 与 artifact 条件写入流程执行，
回滚时保留上一份目录对象和已发布 artifact。
