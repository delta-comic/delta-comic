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

## Phase 2: Vite dev protocol implementation (commit `d0009709`, superseded by native HMR)

- `packages/plugin/vite/dev.ts` exports `createDevPlugin` plus path/id/event constants.
- Four fixed endpoints: `/manifest.json`, `/index.js`, `/index.css`, `/__delta-comic__/hmr`.
- The virtual dev entry (`\0delta-comic:dev-entry`) re-exports the real entry and injects an
  EventSource HMR stub that dispatches a window `delta-comic:plugin-hmr` custom event carrying the
  plugin id.
- This fork (`@voidzero-dev/vite-plus-core@0.2.9`) gotchas:
  - `slash` is not exported; use `normalizePath`.
  - CSS `ModuleNode.type` is `'js'`, so filter only with `isCSSRequest(node.url)`.
  - `?direct` on a CSS module URL returns raw compiled CSS.
  - File changes invalidate the module graph server-side even in `middlewareMode`.
  - `req.socket.encrypted` needs an `'encrypted' in req.socket` guard.
- `vite-plugin-monkey` dependency removed from `packages/plugin/package.json`; lockfile refreshed.

## Native HMR reference: vite-plugin-monkey

- The relevant implementation is `../vite-plugin-monkey/packages/vite-plugin-monkey/src/node/plugins/server.ts`,
  not its userscript CSS plugin. In serve mode it enables `server.cors`, runs
  `server.transformIndexHtml('/', htmlPlaceholder, req.originalUrl)`, extracts the scripts from
  the transformed HTML, and returns ESM imports for those scripts followed by the real entry.
- The transformed scripts include Vite's `/@vite/client`. The browser therefore connects to the
  plugin dev server's native Vite websocket and loads the original source module graph. File
  changes are handled by Vite's HMR client/module graph rather than by a watcher that asks the
  host application to unload and reload a plugin.
- `virtualHtml.ts` supplies the HTML source used by the transform pipeline. `template.ts` injects
  a module script pointing at the generated entry. `fixClient.ts` changes Vite client base
  handling for cross-environment loading; it is a compatibility reference, not code to copy
  without checking Delta Comic's host and websocket configuration.
- The Vue playground explicitly adds `vue()` alongside `monkey(...)` and exercises a real Vue SFC,
  which confirms that native Vite client loading is the relevant mechanism for template/script HMR.

## Why the userscript CSS plugin is not reusable

- `../vite-plugin-monkey/packages/vite-plugin-monkey/src/node/plugins/style.ts` handles imports such
  as `style.css?style` by generating a module that embeds CSS text, creates style nodes, and uses
  `import.meta.hot.accept(cssId, callback)` to replace/clones those nodes. This is designed for
  userscript and Shadow DOM injection.
- Delta Comic's development and production protocol deliberately exposes CSS as an independent
  `/index.css` file. `DevServerPluginModuleReader` fetches that resource and the host's
  `styleActivator` owns a `<style data-plugin>` node and its disposal. Copying `style.ts` would
  create a second injection path, violate the protocol boundary, and risk duplicate styles.
- The plan therefore retains `/index.css` and the host style lifecycle. Native HMR should only
  trigger a no-store refetch and in-place replacement through a private style handle/bridge.

## Delta Comic native-HMR gap (resolved)

- `packages/plugin/vite/dev.ts` now exposes the fixed `/manifest.json`, `/index.js`, `/index.css`
  endpoints only. Its generated entry imports `/@vite/client` and the real entry, plus a CSS
  bridge; the SSE endpoint, watcher middleware, and `EventSource` stub are removed.
- `packages/plugin/lib/composition.ts` no longer listens for `delta-comic:plugin-hmr`; source
  edits propagate through the native Vite graph and never call `pluginRuntime.reloadPlugin()`
  (explicit update/reload paths are preserved).
- `DevServerPluginModuleReader` keeps the first entry URL stable (`/index.js`) so source modules
  share one native HMR graph; `?v=<version>` is appended only on explicit re-reads.
- `packages/app` has its own Vite server on port 5173, but the plugin source is not in that graph.
  The plugin's `/index.js` must load the plugin server's `/@vite/client` so its own graph and
  websocket remain authoritative.

## Native HMR API constraints

- Vite's `import.meta.hot.accept()` accepts self/dependency updates; `dispose` and `prune` can
  manage bridge resources; `import.meta.hot.on()` can observe native events such as
  `vite:beforeUpdate`, `vite:afterUpdate`, `vite:beforeFullReload`, and websocket status events.
- Vite's `handleHotUpdate` hook receives the changed file, affected module nodes, timestamp, and
  server. It can return the module nodes to update or coordinate a specialized update path. The
  bridge design should use this hook or a filtered native event only for the independent CSS
  refresh, never to emit a replacement plugin-reload command.
- Cross-origin native HMR requires CORS for `/@vite/client`, transformed source, Vue compiler
  output, CSS-related modules, and websocket/HMR client URL compatibility. CORS on only the fixed
  protocol endpoints is insufficient.

## Recommended implementation boundary

- Keep the completed protocol and persistence work from commits `d0009709` and `0736f4f0` as the
  baseline: fixed wire paths, shared-runtime transforms, persistent `dev:<port>` metadata, and
  network-only module/CSS loading.
- First implement and test the `/index.js` native Vite bootstrap. It should import the plugin
  server's Vite client and the real `main.ts`, retain the module graph URLs, and never dispatch a
  Delta-specific file-change event.
- Separately prove the independent CSS bridge before changing `moduleReader.ts` or style types.
  The proof must demonstrate that a CSS edit updates the existing host style, handles CSS imported
  by Vue SFCs, does not duplicate styles, and does not invoke plugin activation/lifecycle.
- Only after both proofs pass should the old SSE endpoint/constants and composition listener be
  removed. `PluginRuntime.reloadPlugin()` remains for explicit non-HMR operations.

## Acceptance gaps to close

- Current `packages/plugin/test/vite/dev.integration.test.ts` validates fixed endpoints, CSS
  re-fetching, and SSE; it does not load a browser module graph or prove Vue template/script HMR.
- New tests must cover JavaScript, Vue template, Vue script, plain CSS, scoped CSS, CSS imports,
  asset URLs, add/remove/error/recovery, cross-origin loading, multiple plugin isolation, page
  reload detection, and lifecycle/state behavior.
- Production ZIP CSS and `StoredPluginModuleReader` must remain covered by existing tests after
  the serve-only migration.
