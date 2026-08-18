# Findings

## Existing architecture

- `packages/plugin/vite/index.ts` uses `vite-plugin-monkey` only in serve mode. Build mode configures
  an ES library build and emits both `plugin.zip` and `manifest.json`.
- Shared runtime imports are guarded by `delta-comic-shared-runtime-guard` and rewritten by
  `exposeHostLibraries`; development output must retain those transforms.
- `PluginInstallService` currently forces every resolver through `File -> PluginPackageCodec ->
  files + manifest -> PluginFileStore + PluginArchiveRepository`.
- `InstalledPluginCandidateProvider` currently uses one `PluginModuleReader` for every persisted
  archive.
- `StoredPluginModuleReader` imports a module URL from `PluginFileStore` and injects CSS text during
  activation.
- Runtime behavior after candidate normalization is source agnostic and should remain unchanged.

## Development persistence requirement

- A development installation must retain `dev:<port>` and manifest metadata in the database so it
  survives application restarts.
- JavaScript and CSS must not be stored in the Tauri plugin directory or IndexedDB. They must be
  fetched from the development server on startup and reload.
- The persisted `installerName`/`loaderName` fields can select a network module reader without a
  database migration.

## Vite protocol constraints

- Vite's documented `configureServer` hook supports custom Connect middleware.
- A directly imported cross-origin module needs CORS headers, and all development resources should
  use `Cache-Control: no-cache`.
- Serving transformed source must preserve Vite module graph URLs so nested imports and framework
  transforms continue to work.
- Fixed wire paths should be independent from source entry paths supplied to the Vite plugin.

## Existing issue

- The current uncommitted `manifest.ts` edit checks `!entry.cssPath`, so valid CSS paths are
  discarded and absent paths are passed to `safePluginPath`. The correct condition is
  `entry.cssPath !== undefined`.

## Legacy surface

- `DevScriptCodec` parses userscript `@description` metadata.
- Rust commands `prepare_dev_script`, `decode_dev_meta`, and `install_dev` support the old
  userscript path but have no current TypeScript call sites.
- Cleanup should happen only after the new development source is integrated and references are
  rechecked.

## Phase 2: Vite dev protocol implementation (commit `d0009709`)

- `packages/plugin/vite/dev.ts` exports `createDevPlugin` plus path/id/event constants.
- Four fixed endpoints: `/manifest.json`, `/index.js`, `/index.css`, `/__delta-comic__/hmr`.
- The virtual dev entry (`\0delta-comic:dev-entry`) re-exports the real entry and injects an
  EventSource HMR stub that dispatches a window `delta-comic:plugin-hmr` custom event carrying the
  plugin id.
- This fork (`@voidzero-dev/vite-plus-core@0.2.9`) gotchas:
  - `slash` is not exported; use `normalizePath`.
  - CSS `ModuleNode.type` is `'js'`, so filter only with `isCSSRequest(node.url)`.
  - Vite rewrites `new URL('<literal>', import.meta.url)`, so the HMR URL must be built as
    `new URL(import.meta.url).origin + DEV_HMR_PATH` (no literal first argument).
  - `?direct` on a CSS module URL returns raw compiled CSS.
  - File changes invalidate the module graph server-side even in `middlewareMode`.
  - `req.socket.encrypted` needs an `'encrypted' in req.socket` guard.
- `vite-plugin-monkey` dependency removed from `packages/plugin/package.json`; lockfile refreshed.
