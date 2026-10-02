# Client plugin architecture

Each application session owns one native Cordis `Context` in `composition.ts`. The application
prepares configuration, business collections, UI registrations, network, downloader, database,
and diagnostic services before mounting the shell. Enabled installations load after the shell
mounts. The Web entry and visible Tauri main window both use `index.html`.

## Package Entry

Manifest protocol 2 has optional `client.entry` and `server.entry` fields. A client module exports
a default `readonly Plugin.Function<Config>[]`. Functions use Cordis `name`, `inject`, `provide`,
and Standard Schema `Config` metadata. Plugin authors import types and Context extensions from
`@delta-comic/client`. The build bridge shares Cordis and UI library instances with the host.

Each installation has one parent Fiber. Its functions are child plugins, mounted as a group
before awaiting stability. Cordis coordinates service providers and consumers, including pending
dependencies, disposal, replacement, and restoration. The host maps installation IDs to parents
and derives package state from parent and child Fibers.

## Services And Ownership

`services.ts` implements configuration, content, user, remote-resource, sharing, i18n, and UI
services. Each service owns its business collection. Registrations use the calling Context's
`effect()` and are released when that caller is disposed. The parent Fiber determines package
ownership for child functions. Platform implementations and application registrars stay in their
respective host modules.

`composition.ts` assembles concrete services, adapters, builtin definitions, and installation
readers. `index.ts` exports the public entry. Package internals import local modules. Builtins are
discovered from `builtins/*.builtin.ts`; each file supplies its manifest and function array.

## Installation And Management

`@delta-comic/plugin-install` owns source resolution, manifest validation, ZIP integrity,
persistence transactions, module graph rewriting, and development-server module reading.
Database/file/catalog adapters live in this package. Vite tooling emits manifest resources and
integrity, JSON flow files, icons, and client chunks. Development loading uses Vite's HMR and CSS
bridge. Resource disposal follows the installation parent Context.

Installation records persist enable state and user configuration. Configuration validation uses
each function's native Config, including disabled installations. Management operations are
serialized and update the current module and Fiber mapping.

## Failure And Recovery

A module-load failure or managed FAILED Fiber enters session safe mode. One cleanup per failure
generation unloads all managed packages; host services and builtin Fibers remain available.
Persistent enable values support retry on the next launch. Within safe mode, the plugin page can
enable individual installations and displays persisted enable state, current Fiber state, and
error source. Cleanup errors enter diagnostics. Business-operation errors are reported by their
calling application flow.

## Verification

Native lifecycle tests cover reverse service order, provider disable/restore, function arrays,
failed-group cleanup, individual recovery, configuration validation, and hot replacement.
Installation and builder tests cover integrity, module graphs, CSS disposal, update rollback,
paired packages, and server-only packages. Runtime acceptance includes direct Web/Tauri startup
and the application plugin-management view.
