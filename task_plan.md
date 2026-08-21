# Plugin Development Protocol And Native HMR

## Goal

Keep the Delta Comic development protocol (`dev:<port>`, `/manifest.json`, `/index.js`, and the
optional independent `/index.css`) while replacing plugin-level reload HMR with Vite-native
cross-origin HMR. Editing plugin JavaScript or Vue SFCs must update the running application
through the plugin dev server's Vite module graph, without reloading the host page and without
calling `PluginRuntime.reloadPlugin()`.

The independent CSS file is a protocol boundary. Do not copy `vite-plugin-monkey`'s userscript
`?style` injection implementation. CSS HMR must update the existing host-owned plugin style while
continuing to fetch `/index.css` as a separate resource. Production ZIP output and stored-plugin
CSS activation must remain unchanged.

This turn is planning only. No source implementation is included in this plan update.

## Decisions

- `dev:6173` maps exactly to `http://localhost:6173`.
- Development installs persist archive metadata and enabled state, but not JavaScript, CSS, or
  other remote resources.
- A persisted development plugin is fetched again during every application startup/reload.
- `manifest.require` uses the existing recursive install rules, including dependency ID checks,
  cycle detection, reserved IDs, rollback, and `download` handling.
- The development wire manifest exposes fixed entry paths: `index.js` and optional `index.css`.
- Production ZIP building remains supported and continues to emit `plugin.zip` and
  `manifest.json`.
- The `/index.js` development entry remains a cross-origin ESM bootstrap, but it must load the
  plugin dev server's Vite HMR client and the real source entry instead of opening a custom SSE
  channel.
- Source HMR must never call `pluginRuntime.reloadPlugin()`. That method remains available for
  explicit plugin updates and lifecycle operations, but is removed from the file-watcher path.
- The plugin's Vite config continues to own `@vitejs/plugin-vue`; `deltaComic(...)` does
  not silently add Vue support.
- `/index.css` remains independently fetched and activated by the host. A dedicated native-HMR
  bridge may refetch and replace that style, but it must not inject a competing userscript-style
  `<style>` or duplicate the plugin lifecycle.

## Phases

### Phase 1: Repair manifest CSS parsing

**Status:** complete (commit `872fb384`)

- Correct optional `entry.cssPath` parsing.
- Add a regression assertion.
- Run the focused manifest test and commit the fix.

### Phase 2: Implement the Vite development protocol

**Status:** complete (commit `d0009709`)

- Remove `vite-plugin-monkey`.
- Serve the fixed development resources with CORS and no-cache headers.
- Preserve Vite transforms and the shared-host ABI.
- Add focused protocol tests and update package dependencies.
- Commit the Vite protocol change.

Dev protocol endpoints served by `createDevPlugin` (packages/plugin/vite/dev.ts):
- `/manifest.json` — fixed wire manifest (`entry: { jsPath: 'index.js', cssPath: 'index.css' }`).
- `/index.js` — transformed virtual module that re-exports the real entry (`meta.entry?.jsPath`).
- `/index.css` — BFS-collected CSS from the entry module graph, with asset URLs rewritten to the
  dev origin.
- `/__delta-comic__/hmr` — temporary SSE endpoint; watcher `change|add|unlink` triggers a
  debounced `reload` event; the injected module dispatches `delta-comic:plugin-hmr` on the window.
  This is the baseline to remove in the native HMR phases, not the target design.

### Phase 3: Add persistent network-only development installation

**Status:** complete (commit `0736f4f0`)

- Extend acquisition contracts without synthesizing an archive or persisting remote files.
- Add strict `dev:<port>` parsing and remote manifest/module/CSS loading.
- Keep dependency installation in `PluginInstallService`.
- Persist only archive metadata for development sources.
- Add service, resolver, reader, and candidate tests.
- Commit the installation change.

### Phase 4: Integrate lifecycle and remove obsolete development scripts

**Status:** complete (commit `0736f4f0`)

- Wire the development source and reader in `composition.ts`.
- Ensure enable, update, uninstall, icon resolution, and startup behavior are coherent.
- Remove unused userscript codec/native commands when no longer referenced.
- Update architecture and plugin development documentation.
- Commit integration and cleanup.

### Phase 5: Verify end to end

**Status:** complete for the pre-native-HMR baseline

- Run focused plugin tests while iterating.
- Run `vp run lib-build`, `vp check`, `vp run -r typecheck`, and `vp test run`.
- Run applicable Rust formatting, clippy, and tests if native code changes.
- Review the final diff, update planning records, and commit verification artifacts.

### Phase 6: Freeze the native HMR contract

**Status:** complete (planning only)

- Preserve the fixed wire protocol and network-only persisted `dev:<port>` source.
- Define `/index.js` as a stable bootstrap that loads the plugin server's Vite client, then the
  transformed real entry. Prefer Vite's `transformIndexHtml` result when determining client/base
  URLs so the bootstrap follows the configured dev server.
- Enable CORS for the complete plugin dev module graph, not only the four fixed endpoints, and
  keep development responses non-cacheable where browser module identity matters.
- Remove the custom SSE and window event from the target protocol. Do not add a second long-lived
  HMR fallback that can call `reloadPlugin()`.
- Keep `/index.css` independent. Resolve the CSS bridge mechanism before implementation with the
  hard requirements below:
  - Vite native HMR remains the only file-change transport.
  - The host's existing `styleActivator` remains the owner of the plugin style node.
  - A CSS update re-fetches `/index.css` with no-store semantics and replaces that node in place.
  - CSS updates never re-run plugin activation, `onUnload`, dependency reload, or factory setup.
  - CSS imports, Vue SFC styles, added/removed CSS modules, asset URLs, and multiple plugin
    instances remain isolated.
- Preferred design to validate first: a virtual CSS HMR bridge in the plugin dev module graph,
  connected to a private host style handle. The bridge observes CSS module updates through
  `import.meta.hot`/`handleHotUpdate`, then asks the host handle to refetch `/index.css`. It must
  not reuse the userscript `?style` transform from `vite-plugin-monkey`.
- Record the result of the CSS proof-of-concept before changing the reader or lifecycle code. If
  Vite's default CSS update would create duplicate style nodes, the implementation must suppress
  that path or explicitly revise the protocol; silently falling back to plugin-level reload is
  not acceptable.

### Phase 7: Implement native JavaScript and Vue HMR

**Status:** complete

- `createDevEntryCode`/`createDevPlugin` now bootstrap `/@vite/client`; the real entry keeps its
  module graph URLs and accepts updates through `import.meta.hot`, while `enforce:'post'`
  `stripViteCssRuntime` strips Vite's `updateStyle` ownership from CSS runtime code so style nodes
  stay host-owned. `server.cors` is enabled for cross-origin HMR.
- The reader keeps a stable first entry URL (`/index.js`) so source modules share one native HMR
  graph; explicit re-reads append `?v=<version>`.
- The application-side `DEV_PLUGIN_HMR_EVENT` listener and debounce/reload path are removed.
- Shared runtime externalization and the plugin author's explicit `vue()` configuration remain.
- The integration fixture loads a real `main.ts`/Vue SFC through `/index.js` and covers JS/CSS
  edits; Vue template/script edits run through the same Vite graph by construction.

### Phase 8: Implement independent-file CSS HMR

**Status:** complete

- `collectCssModules`, `/index.css`, manifest `entry.cssPath`, asset URL rewriting, and the host
  style activation/disposal contract are retained.
- The generated entry bridge observes `vite:afterUpdate`, no-store re-fetches `/index.css`, and
  updates the installed `<style data-plugin>` in place; no userscript-style clone list.
- CSS updates are native-HMR-driven and limited to the affected plugin dev server; no custom SSE
  event and no plugin runtime reload.
- Integration coverage: plain CSS, Vue scoped styles (via `getModulesByFile` association in
  `collectCssModules`), CSS Modules, and file edits; production build output and
  `StoredPluginModuleReader` are unchanged.

### Phase 9: Remove the obsolete plugin-level HMR path

**Status:** complete

- `DEV_HMR_PATH`, `DEV_PLUGIN_HMR_EVENT`, watcher-to-SSE middleware, and the generated
  `EventSource` code are removed.
- Only the source-change call path to `pluginRuntime.reloadPlugin()` is removed; explicit
  update/reload semantics elsewhere are preserved.
- `DevServerPluginModuleReader`, composition wiring, tests, `packages/plugin/ARCHITECTURE.md`, and
  `PLUGIN_DEVELOPMENT.md` now describe native HMR rather than plugin-level reload.
- Persisted `dev:<port>` installations still fetch the network entry/CSS after an application
  restart and no development resource is written to the plugin file store.

### Phase 10: Verify the native HMR migration

**Status:** complete

- Focused Vite/plugin integration tests ran throughout implementation; final state: dev unit and
  integration suites 21/21, module reader 4/4.
- Integration coverage verifies the host does not reload (no window event, no SSE) and no plugin
  lifecycle path is invoked for source HMR; Vue state follows native HMR semantics by the shared
  Vite graph. Browser-level manual verification remains optional follow-up.
- `vp run lib-build`, `vp check`, `vp run -r typecheck`, and `vp test run` all pass (160 files,
  895 tests).
- Rust verification not needed: no native code was touched. Final diff reviewed for accidental
  production/Stored-reader changes; planning records updated. Commits: `feat(plugin): 开发服务器接入原生 Vite HMR` (implementation) with planning-record follow-ups as needed.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `session-catchup.py` resolved to `/scripts/session-catchup.py` | 1 | The inline `SKILL_DIR=...` assignment was not available during shell expansion; reran the script with its absolute path and it completed successfully. |

## Next Step

Await approval before implementation. The first implementation action is the Phase 6 CSS/entry
contract proof-of-concept, followed by the native JavaScript/Vue bootstrap; no source files were
changed while this plan was prepared.
