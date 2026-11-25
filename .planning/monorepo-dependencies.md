# Monorepo dependency map

This map reflects the workspace package manifests and Rust path configuration at `develop` commit `650aaf2c`.

## JavaScript workspace

Solid arrows are declared workspace dependencies. Dotted arrows are peer dependencies. Dashed arrows are development-only dependencies.

```mermaid
flowchart TD
  root[Root tooling] --> codegen[codegen-cli]
  root --> release[release-cli]

  app --> client[client SDK]
  app --> db[db]
  app --> downloader[downloader]
  app --> http[http]
  app --> logger[logger]
  app --> model[model]
  app --> plugin[plugin core]
  app --> ui[ui]
  app --> utils[utils]
  app -. dev .-> runtime[runtime host]

  plugin --> client
  plugin --> logger
  plugin --> manifest[manifest]
  plugin --> install[plugin install]
  plugin --> vite[plugin vite]
  plugin -. peer .-> db
  plugin -. peer .-> model
  plugin -. peer .-> ui
  plugin -. peer .-> utils

  db --> logger
  db --> manifest
  db -. peer .-> model
  model --> logger
  model --> manifest
  ui --> logger
  ui -. peer .-> model
  ui -. peer .-> utils
  utils --> logger

  install --> logger
  install --> manifest
  install --> model
  install --> artifact[plugin artifact]
  install -. dev .-> db

  vite --> manifest
  vite --> install
  vite --> utils
  vite -. dev .-> db

  client -. dev .-> db
  client -. dev .-> downloader
  client -. dev .-> manifest
  client -. dev .-> model
  client -. dev .-> vite
  client -. dev .-> ui
  client -. dev .-> utils

  runtime --> client
  artifact --> manifest
```

## Rust workspace paths

The Rust workspace declarations below still point at the pre-flattening layout. Those directories are absent in this checkout. The matching crates currently live directly under `packages/`.

```mermaid
flowchart LR
  app_rs[app/src-tauri]
  app_rs -. stale path .-> db_rs[packages/platform/db]
  app_rs -. stale path .-> downloader_rs[packages/platform/downloader]
  app_rs -. stale path .-> http_rs[packages/platform/http]
  app_rs -. stale path .-> logger_rs[packages/core/logger]
  app_rs -. stale path .-> plugin_rs[packages/plugin/core]
  app_rs -. stale path .-> utils_rs[packages/core/utils]
```

## Additional stale references

- Root TypeScript project references still name the pre-flattening Rust and UI package paths.
- The client SDK's Vite aliases still point at the pre-flattening db, downloader, manifest, and UI paths.
- Release discovery and codegen checks still reference the pre-flattening package locations.
- The lockfile records workspace links to package paths that no longer exist.

