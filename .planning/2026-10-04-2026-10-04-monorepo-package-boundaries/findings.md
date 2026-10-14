# Findings

## Baseline

- Branch: `develop`.
- Existing user changes are present in desktop/mobile manifests, desktop subscribe page, Vite config, and `pnpm-lock.yaml`; preserve them.
- Workspace glob is `packages/*/*/*`.

## Inventory

- The final workspace scan covers 21 package manifests. Every `@delta-comic/*` dependency uses the exact `workspace:` range.
- A relative-import resolver found no source or configuration import crossing from one package directory into another.
- A residual text scan found no `../core`, `core/lib/components`, sibling plugin adapter, or app runtime path references in package source/configuration.

## Concrete violations

- Five package manifests use `workspace:*` for peer dependencies: `@delta-comic/db` -> model; `@delta-comic/ui` -> model/utils; `@delta-comic/plugin` -> db/model/ui/utils. The repository rule requires exact `workspace:`.
- Root `lib-build` only reaches HTTP, mobile, and desktop. `vp run -r build` reaches 22 configured package tasks and additionally builds the admin app; this is the complete current Vite+ build graph.
- `@delta-comic/logger-native` is a workspace package with no Vite config, pack entry, or build task.
- App mobile/desktop configs and CSS/tsconfig include core sources through `../core`; generated `components.d.ts` files preserve those cross-package imports.
- App core tests load the runtime UMD from mobile's public directory. Runtime config writes mobile and desktop public directories directly.
- `plugin-install` test imports `MemoryPluginFileStore` through `../../../../plugin/lib/adapters` instead of the plugin package.
- Rust Tauri crates export generated bindings into sibling package paths. These are native workspace path operations and need separate treatment from npm package resolution; the JS/config boundary fixes below remove all TypeScript/CSS/test cross-package paths.

## Chosen implementation

- Normalize all internal npm dependency ranges to exact `workspace:` and regenerate the lockfile with Vite+.
- Make `lib-build` delegate to `vp run -r build`, so every configured package build task is part of the build gate.
- Give `@delta-comic/logger-native` a small pack entry and build task.
- Resolve core components, declarations, and runtime files through package exports (`import.meta.resolve`) and move runtime UMD output into the runtime package `dist`; copy it into each app's own public directory during app build.
- Add a package export for core component declarations and runtime UMD; replace core test/runtime cross-package relative imports with package imports.
- Export plugin adapters and consume them through `@delta-comic/plugin` in plugin-install tests.

## Validation note

- The complete build graph and recursive typecheck pass. Six mobile/desktop test files retain 10 failures around Vapor components mounted from VDOM tests; the errors are `vaporInteropPlugin` setup failures and are independent of package path resolution.
