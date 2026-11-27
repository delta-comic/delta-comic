# Client plugin architecture

Each application session owns one native Cordis `Context` in `composition.ts`. The application
prepares configuration, business collections, UI registrations, network, downloader, database,
and diagnostic services before mounting the shell. Enabled installations load after the shell
mounts. The Web entry and visible Tauri main window both use `index.html`.

## Package Entry

Plugin authors import `deltaComic` from `@delta-comic/client/vite`. The build reads the npm
package name and version, bundles the optional Cordis entry and public exports into one
registration script, and emits declarations and a ZIP. Declare cross-plugin package names in
`pluginPeers` and their compatible versions in `peerDependencies`. A format 2 manifest lists
the exact external requests, exported module paths, host range and resource hashes.

The host verifies the manifest and bytes before registration. A script provides a factory.
Its consumer-bound resolver reads the host ESM namespaces or a provider's cached exports.
The runtime records successful module reads, including deferred requests.

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

`@/plugin/install` owns source resolution, manifest validation, ZIP integrity,
revision storage, registration and activation transactions.

SQLite stores the active manifest revision. IndexedDB and Tauri store the verified bytes by
installation ID and revision. Development builds publish successful revisions over SSE. The host
reads the corresponding resources and follows the same installation path as ZIP upgrades.

## Replacement and recovery

The management queue checks declared peer ranges and module paths before stopping consumers. The
runtime freezes generations in the reverse closure of successful reads. The host disposes their
fibers, rebuilds the affected factories and mounts their components in dependency order.
Failure during activation or persistence restores the preceding closure. Unrelated fibers keep
their state. Legacy installations require a rebuild with the current SDK.
