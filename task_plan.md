# Plugin development protocol refactor

## Goal

Replace the `vite-plugin-monkey` development path with a Delta Comic protocol that serves
`index.js`, `index.css`, and `manifest.json`. Add persistent `dev:<port>` installations whose
metadata remains in the plugin repository while executable resources are always loaded over the
network and never written to the plugin file store.

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

## Phases

### Phase 1: Repair manifest CSS parsing

**Status:** complete

- Correct optional `entry.cssPath` parsing.
- Add a regression assertion.
- Run the focused manifest test and commit the fix.

### Phase 2: Implement the Vite development protocol

**Status:** pending

- Remove `vite-plugin-monkey`.
- Serve the fixed development resources with CORS and no-cache headers.
- Preserve Vite transforms and the shared-host ABI.
- Add focused protocol tests and update package dependencies.
- Commit the Vite protocol change.

### Phase 3: Add persistent network-only development installation

**Status:** pending

- Extend acquisition contracts without synthesizing an archive or persisting remote files.
- Add strict `dev:<port>` parsing and remote manifest/module/CSS loading.
- Keep dependency installation in `PluginInstallService`.
- Persist only archive metadata for development sources.
- Add service, resolver, reader, and candidate tests.
- Commit the installation change.

### Phase 4: Integrate lifecycle and remove obsolete development scripts

**Status:** pending

- Wire the development source and reader in `composition.ts`.
- Ensure enable, update, uninstall, icon resolution, and startup behavior are coherent.
- Remove unused userscript codec/native commands when no longer referenced.
- Update architecture and plugin development documentation.
- Commit integration and cleanup.

### Phase 5: Verify end to end

**Status:** pending

- Run focused plugin tests while iterating.
- Run `vp run lib-build`, `vp check`, `vp run -r typecheck`, and `vp test run`.
- Run applicable Rust formatting, clippy, and tests if native code changes.
- Review the final diff, update planning records, and commit verification artifacts.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| None | - | - |

## Next Step

Commit the verified manifest fix, then implement the Vite development protocol.
