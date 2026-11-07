# Progress

## 2026-11-07

- 完成初始状态检查和 server/cloud 依赖边界确认。
- 已获用户授权执行破坏性删除与包名重命名。
- 删除全部服务端与管理后台代码、服务端 workflow、服务端 codegen schema、D1 生成物和相关文档。
- 删除客户端 server-backed cloud stores、测试、配置和 i18n，保留插件自身收藏同步。
- 将 workspace 包迁移到 `packages/<domain>/<package>`，同步 npm、Cargo、TS、Vite、CI 和发布引用。
- 通过 `vp install`、`vp run build:packages`、`vp check`、`vp run -r typecheck`、`vp test run`、
  codegen check、Rust fmt、clippy 与 workspace tests。

