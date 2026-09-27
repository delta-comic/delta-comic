# @delta-comic/logger

Delta Comic 的统一日志 SDK 与 Tauri 2 插件。浏览器端自动回退到控制台；Tauri 端会把前端、Rust 和插件日志汇聚到同一套异步日志文件中。

```ts
import { logger } from '@delta-comic/logger'

const log = logger.scoped('my-plugin:sync')
log.info('sync started', { itemCount: 12 })
log.error('sync failed', error)
```

宿主应用应尽早安装全局捕获，用于复制 `console` 输出并捕获未处理错误：

```ts
import { installGlobalLogger } from '@delta-comic/logger'

installGlobalLogger()
```

Rust 宿主需要在其他插件之前注册插件，之后可直接使用 `tracing`：

```rust
tauri::Builder::default()
  .plugin(tauri_plugin_logger::init())
  .plugin(other_plugin);

tracing::info!(target: "my_plugin::sync", items = 12, "sync started");
```

日志格式固定为 `[yyyy/mm/dd hh:MM:ss] (scope) level > content`。文件按日和 5 MiB 分块，30 天后 gzip 归档，90 天后删除。前端传输使用批量队列，Rust tracing 事件入口使用有界非阻塞队列，文件写入由 Tokio worker 完成。

原生读取与导出 API 只接受插件列出的安全文件名，不接受绝对路径或目录穿越。`listLogFiles`、`readLogFile` 和 `exportLogs` 需要宿主授予 `logger:default` capability。
