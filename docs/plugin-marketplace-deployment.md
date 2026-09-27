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
vp -C packages/server/core/server exec wrangler deploy --config dist/delta_comic_server/wrangler.json
```

当前免费账号部署采用单 Worker 模式。`worker_loaders` 未加入生产配置，插件路由、目录发布、SQL migration 和静态 Cordis runtime 可以正常使用；依赖 Workers for Platforms 的动态旧插件脚本在该部署模式下会记录清晰错误，应用的其他定时任务仍继续运行。

当前测试部署使用免费 D1 `delta-comic-server-db`，远程迁移已执行完成。部署后的健康检查：

```text
GET https://delta-comic-server.wenxig.workers.dev/api/health/live -> 200
GET https://delta-comic-server.wenxig.workers.dev/plugins/catalog/index.json -> 404
POST https://delta-comic-server.wenxig.workers.dev/plugins/catalog/releases -> 404
```

目录相关路径返回 404 的原因是测试部署未配置 `PLUGIN_CATALOG` R2 binding。免费账号使用当前单 Worker 静态能力继续运行，动态脚本保持明确的不可用错误。

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

发布器会校验 HTTPS artifact URL、Manifest URL、平台、完整性值、版本和目录条目。artifact 文件上传、发布者账户、签名凭证、并发版本控制和完整管理后台仍需后续实现。

## 变更操作

目录索引由 R2 object `catalog/index.json` 保存。发布和撤回请求会读取当前目录、应用一次领域变更并写回 JSON。生产环境变更前应保存当前 object，发布后检查目录中的 `generatedAt`、插件 ID 和版本。

当前目录存储接口提供 `load/save`，发布流程尚未接入条件写入或版本号校验。多人并发发布时应安排单一发布窗口，待 CAS 或队列协调能力完成后再开放并行发布。

## 未覆盖的部署事项

以下清单保持未完成状态：

- Workers for Platforms runtime provisioning 与每安装实例隔离部署
- D1 per-installation binding 自动创建与配额管理
- 发布者账户、凭证轮换和审计日志
- app 与 server-admin 的市场管理界面
- 生产环境回滚、灾备和完整 CI/CD 发布流水线
