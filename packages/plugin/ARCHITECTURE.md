# Plugin architecture

The client plugin package uses a directed dependency graph. Code is grouped by responsibility,
and only the composition root may assemble concrete adapters and application services.

```text
api <- kernel <- runtime
        ^         install <- adapters
        |
   capabilities

builtins -> api
composition -> capabilities / adapters / runtime / install / builtins
index -> public API and read-only facades

install/PluginCatalog <- adapters/awesomeRegistry
                         ^
                         composition -> app/features/pluginMarketplace
```

## Import rules

- `api` contains the plugin author contract and pure helpers.
- `kernel` contains source-agnostic primitives such as candidates, scopes, contributions, and
  capability modules.
- `runtime` depends only on API and kernel protocols. Installed-source normalization lives in
  `install`, so the runtime never knows how a candidate was persisted or decoded.
- `install` owns package acquisition protocols and provider-neutral catalog ports. It depends on
  ports instead of concrete persistence, registry, UI, or platform implementations.
- `adapters` implement kernel/install ports and never import application services. External wire
  schemas are translated to host contracts at this boundary.
- `builtins` use the same public author contract as external plugins.
- `composition.ts` is the only place allowed to assemble capabilities, adapters, providers, and
  runtime services.
- `index.ts` is export-only. Package code must never import `@/index` or self-import
  `@delta-comic/plugin`.

Globs are reserved for homogeneous discovery. Each `*.builtin.ts` file default-exports an
`InternalPluginDefinition`, so adding an internal plugin requires a file rather than a composition
change. Lifecycle and capability order is always an explicit list in the composition root.

## Extension rule

A new business capability is implemented as a vertical module with its contract, registry view,
and activation behavior. It is then added once to the explicit capability list in
`createDefaultCapabilities`. The activation pipeline itself must not gain plugin IDs, origins, or
feature-specific branches. Host-only operations such as authentication are injected through a
gateway; plugin contracts never import application UI.

The product marketplace is an application feature, not a plugin-runtime layer. Its loading and
view models live under `packages/app/src/features/pluginMarketplace`. The concrete
`awesome-plugins` network, schema, and cache implementation lives under
`adapters/awesomeRegistry`; install source resolution sees only `PluginInstallCatalog`.

Internal and installed plugins are normalized to `PluginCandidate` before dependency planning.
Everything after `candidate.load()` is source-agnostic and shares the same activation, rollback,
reload, and unload behavior.

## Runtime flow

```text
*.builtin.ts --------> InternalPluginCandidateProvider --+
                                                          |
archive -> module reader (stored files or dev-server network) -> InstalledPluginCandidateProvider +-> collision check
                                                              -> dependency plan
                                                              -> module + factory preload
                                                              -> onPreboot scope
                                                              -> serial normal capability pipeline
                                                              -> normal scope
```

Every plugin enabled at application startup is prepared before Vue mounts. Preparation loads its
module, evaluates its factory once, and runs only `onPreboot`; declarative capabilities remain
inactive. A later user selection reuses the prepared config and activates the plugin's normal part.
Normal reloads dispose only the normal scope, so they do not rerun the factory or preload hook.
Plugins installed or updated after this startup snapshot are loaded immediately instead of
requiring an application restart: `PluginRuntime.enablePlugin`/`enablePlugins` prepare the
candidate (and activate it once normal parts are booted), `disablePlugin` deactivates and unloads
it in LIFO order, and `reloadPlugin` unloads a plugin together with its prepared dependents and
loads the current files again. The persisted flag changes are orchestrated by `setPluginEnabled`,
while `installPlugin` reloads the result of an install or update right away.

Installed archives select their module reader at candidate load time. ZIP archives use the stored
file reader; `dev:<port>` archives use the development-server reader, which fetches the fixed
entry and optional CSS paths without relying on the file store. This distinction is kept in the
install composition and does not enter the runtime dependency planner or activation pipeline.

The composition root also owns host integrations for development reloads and relative icons. The
Vite development entry emits `delta-comic:plugin-hmr`; the host debounces the event and calls
`reloadPlugin`, while development icon paths resolve against the same localhost port. Runtime and
plugin author contracts remain unaware of these transport details.

Endpoint probes within one remote group may run in parallel with independent abort
signals. Plugin dependency levels and capability modules are deliberately activated serially so
registration and rollback order stays deterministic. Every mutable host registration must attach
its inverse operation to `PluginScope`; unload and failed activation run those inverses in LIFO
order.

## Change matrix

| Change | Add or edit | Must remain unchanged |
| --- | --- | --- |
| Built-in plugin | Add one default-exporting `builtins/*.builtin.ts` definition | composition, runtime, installed loader |
| Installed package format | Add a `PluginPackageCodec` and wire it in composition | candidate protocol, runtime, capabilities |
| Download source | Add a `PluginSourceResolver` and wire it in composition | codecs, candidate protocol, runtime |
| Development source | Add the `dev:<port>` resolver and network module reader in composition | runtime pipeline, ZIP codec, dependency planner |
| Catalog provider | Add an adapter implementing `PluginCatalog` and wire it in composition | install resolver, runtime, application view model |
| Business model | Add an API model plus one capability module; optionally add a typed contribution channel | candidate providers, dependency planner, runtime engine |
| Host-only UI/platform operation | Add a narrow gateway interface and inject its host adapter | public plugin model, runtime kernel |

Application code reads declarative models through `PluginStore.modelEntries()` or a typed
`ContributionHub` channel. It must not recreate origin-specific registries. There is no fallback
`Global`, booter registry, loader registry, or compatibility export layer; adding one would create a
second ownership model and violate this architecture.
