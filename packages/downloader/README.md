# `tauri-plugin-downloader`

Delta Comic 的跨平台下载引擎。Rust crate、Tauri 命令与 `@delta-comic/downloader`
TypeScript SDK 位于同一个 workspace package 中，下载状态只由 Rust 引擎维护。

## 架构

```text
Vue / Pinia snapshot
        │ Tauri IPC + revisioned events
        ▼
queue scheduler ── SQLite repository (WAL)
        │
        ├── HTTP adapter (reqwest + tokio)
        │      ├── range probe and interval ledger
        │      ├── bounded parallel workers
        │      └── .part file + checksum + atomic commit
        │
        ├── BitTorrent adapter (librqbit)
        │      └── supervised sessions + fast resume
        │
        └── destination and platform lifecycle adapters
```

数据库保存任务、队列顺序、来源、验证器和已完成区间。HTTP 响应中的合法
`Content-Range` 是实际写入偏移的唯一依据；服务器忽略 Range 并返回完整 `200`
时会取消其他 worker，截断临时文件并切换到单流下载。完成文件先写入同目录的
`.part` 文件，校验成功后再重命名。

桌面默认目录是系统 Downloads；Android 默认目录是应用数据目录下的
`downloads`。用户登记的 SAF provider 支持 seek 时，HTTP 分片直接写入持久化临时
文档并在重启后续传；不支持 seek 时自动回退私有 staging 后导出。入队命令只接受已经
登记的 destination ID 和经过清洗的相对路径。

## 接入

Rust：

```rust
tauri::Builder::default()
  .plugin(tauri_plugin_downloader::init());
```

能力文件至少需要 `downloader:default`。删除磁盘文件还需要独立的
`downloader:allow-delete-files` 权限。系统凭据写入和删除分别使用
`downloader:store-secrets` 与 `downloader:delete-secrets`，便于宿主按最小权限授权。

TypeScript：

```ts
import { deleteSecret, enqueueUrl, listenTaskUpsert, storeSecret } from '@delta-comic/downloader'

const secretRef = await storeSecret('Bearer private-token')
await enqueueUrl({
  url: 'https://example.com/archive.zip',
  priority: 8,
  mirrors: [{
    url: 'https://example.com/archive.zip',
    headers: { Authorization: { type: 'secretRef', secretRef } },
  }],
})
const unlisten = await listenTaskUpsert(({ task }) => console.info(task.status))
// 不再需要凭据时显式删除；重复删除是安全的。
await deleteSecret(secretRef)
```

HTTP 请求头可以直接提供普通值。Cookie、Authorization 等敏感值应通过上述系统凭据
API 生成不透明 `credential:` 引用；macOS 使用 Keychain、Windows 使用 Credential
Manager、Android 使用 Keystore，秘密本身不会写入下载数据库、事件或普通日志。宿主仍可
注入自定义凭据解析器，但原生 `credential:` 引用不会回退到宿主解析器。

## 开发与验证

从项目根目录运行：

```sh
vp install
vp check
vp test run
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

轻量、可配置的真实引擎性能基线位于 workspace 中，默认拒绝运行以防误触发大流量：

```sh
DOWNLOADER_BENCHMARK_ENABLE=1 \
DOWNLOADER_BENCHMARK_BYTES=8388608 \
DOWNLOADER_BENCHMARK_SHARDS=1,4 \
DOWNLOADER_BENCHMARK_TASKS=1 \
cargo run -p downloader-performance-baseline --release
```

工具通过本地 Range 服务、真实 Engine/SQLite/reqwest 路径输出 JSON，记录吞吐、请求并发、
SQLite 体积、CPU 和峰值常驻内存；`DOWNLOADER_BENCHMARK_MAX_TOTAL_BYTES` 是防止误配的
总传输上限。

真实平台验收还应覆盖 Windows MSVC、macOS、Android API 26/33/34/36、进程强制
终止后的恢复、大文件及受限网络。当前低性能开发机不运行 Android 模拟器或真机测试，
改用 JVM、JNI 契约和 Rust 故障注入测试；这不等价于最终发布前的真机验收。Android 的
系统“强制停止”会阻止任何后台组件，任务只能在用户下次显式打开应用后恢复。
