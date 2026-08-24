# Delta Comic — 开发进度与规划

> 目标：重构 `packages/plugin`，废弃 `vite-plugin-monkey`，实现自定义 Vite 开发协议
> （`index.js` / `index.css` / `manifest.json`）+ 持久化的 `dev:<port>` 网络安装适配器。

## 已完成

| 阶段 | 提交 | 说明 | 状态 |
| --- | --- | --- | --- |
| Phase 1 | `872fb384` | 修复插件 manifest CSS 入口解析 | ✅ |
| Phase 2 | `d0009709` | 自定义 Vite 开发协议 + 移除 vite-plugin-monkey | ✅ |
| 进度记录 | `c5951691` | 规划文件（task_plan/findings/progress）落盘 | ✅ |

Phase 2 产物：`packages/plugin/vite/dev.ts`（200 行）+ `dev.test.ts` + `dev.integration.test.ts`
+ `index.ts`/`package.json`/`pnpm-lock.yaml` 修改。完整验证链通过（888 tests）。

## 当前阶段：Phase 3（实现中）

**目标**：持久化 `dev:<port>` 网络安装（元数据入库，代码/CSS 仅网络加载，`require` 走标准递归安装）。

**已确认设计**（架构探索完毕，待实现）：

1. **`contracts.ts`**
   - `ResolvedPluginSource` 增 `package?: DecodedPluginPackage`、`storage?: 'archive' | 'remote'`
   - `PluginModuleReader` 改为 `read(archive: PluginArchiveDB.Archive, signal)` + `id` + 可选 `matches?(archive)`
   - 导出 `DEV_SERVER_LOADER_ID = 'dev-server'` 等常量

2. **`source.ts`**：新增 `DevServerSourceResolver`
   - `id = 'dev-server'`，`matches` 匹配 `/^dev:(\d+)$/`（port 1-65535）
   - `resolve`：fetch `http://localhost:<port>/manifest.json` → `parsePluginManifest`
     → 再取 `index.js`（+ 可选 `index.css`）→ 文本
   - 返回 `{ package: { codecId: 'dev-server', files: 空 Map, manifest }, installInput, resolverId, storage: 'remote' }`

3. **`service.ts`**
   - `source.package` 存在时跳过 codec 步骤
   - `storage === 'remote'` 时 `files.replace(plugin, new Map())` 清空文件（元数据仍 upsert）
   - `loaderName = source.package?.codecId ?? decoded.codecId`

4. **`moduleReader.ts`**：新增 `DevServerPluginModuleReader`
   - `matches` 匹配 `archive.loaderName === 'dev-server'`
   - 按 `installInput` 端口 import `http://localhost:<port>/index.js?v=<每插件计数>`
   - fetch CSS 文本，样式注入复用 Stored 逻辑；CSS 404 容忍

5. **`candidateProvider.ts`**：`InstalledPluginCandidateProvider` 接受 `readonly PluginModuleReader[]`
   - 路由：`find(r => r.matches?.(archive)) ?? find(r => !r.matches) ?? readers[0]`

6. **`composition.ts`**：`resolvers` 加 `DevServerSourceResolver`；`InstalledPluginCandidateProvider`
   改为接收 `[StoredPluginModuleReader, DevServerPluginModuleReader]`

**验证**：`vp run lib-build` → `vp check --fix` → `vp run -r typecheck` → `vp test run`

## 后续规划（Phase 4 / 5）

- Phase 4：composition 接线（HMR host 监听 `delta-comic:plugin-hmr` + debounce + `reloadPlugin`；
  `resolvePluginIconUrl` 对 dev 相对图标按 dev base URL 解析；移除 DevScriptCodec + userscript
  Rust 命令；更新 `PLUGIN_DEVELOPMENT.md` §9/§9.1 + `ARCHITECTURE.md`）
- Phase 5：全链路验证 + 提交
