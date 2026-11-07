# Findings

- 当前分支为 `develop`，工作区初始干净。
- `packages/server` 有 162 个已跟踪文件，包含 Worker、D1、管理后台和服务端测试。
- 客户端 server-backed cloud 仅由 `packages/client/app/core/lib/cloud/**`、`stores/cloud.ts`、对应测试和 core plugin 配置使用。
- 收藏页的 `user.favourites.download/upload` 是插件能力，不依赖 server，按用户确认保留。
- workspace 当前 glob 为 `packages/*/*/*`，目标为 `packages/*/*`。

