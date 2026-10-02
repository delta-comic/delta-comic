# @delta-comic/logger

Delta Comic 的跨端结构化日志核心。核心提供 scoped logger、console 捕获、错误捕获和可注入 transport；服务端与客户端共用同一条日志记录契约。

```ts
import { logger } from '@delta-comic/logger'

const log = logger.scoped('my-plugin:sync')
log.info('sync started', { itemCount: 12 })
log.error('sync failed', error)
```

宿主应用应尽早安装全局捕获，用于复制 `console` 输出并捕获未处理错误。客户端应用向 logger 注入 Tauri transport：

```ts
import { installGlobalLogger, logger } from '@delta-comic/logger'
import { TauriLoggerClient } from './logger/TauriLoggerClient'

logger.setTransport(new TauriLoggerClient())
installGlobalLogger()
```

Tauri 原生日志 crate 位于 `packages/client/platform/logger`。Rust 宿主需要在其他插件之前注册插件，之后可直接使用 `tracing`：

```rust
tauri::Builder::default()
  .plugin(tauri_plugin_logger::init())
  .plugin(other_plugin);

tracing::info!(target: "my_plugin::sync", items = 12, "sync started");
```

日志格式固定为 `[yyyy/mm/dd hh:MM:ss] (scope) level > content`。文件按日和 5 MiB 分块，30 天后 gzip 归档，90 天后删除。前端传输使用批量队列，Rust tracing 事件入口使用有界非阻塞队列，文件写入由 Tokio worker 完成。

客户端原生读取与导出由宿主适配器提供，只接受插件列出的安全文件名，不接受绝对路径或目录穿越；对应 command 需要宿主授予 `logger:default` capability。
