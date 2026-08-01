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
```

## Import rules

- `api` contains the plugin author contract and pure helpers.
- `kernel` contains source-agnostic primitives such as candidates, scopes, contributions, and
  capability modules.
- `runtime` depends only on API and kernel protocols. Installed-source normalization lives in
  `install`, so the runtime never knows how a candidate was persisted or decoded.
- `install` depends on kernel ports instead of concrete persistence, UI, or platform
  implementations; `adapters` supplies those implementations.
- `adapters` implement kernel ports and never import application services.
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

Internal and installed plugins are normalized to `PluginCandidate` before dependency planning.
Everything after `candidate.load()` is source-agnostic and shares the same activation, rollback,
reload, and unload behavior.

## Runtime flow

```text
*.builtin.ts --------> InternalPluginCandidateProvider --+
                                                          |
archive + module port -> InstalledPluginCandidateProvider +-> collision check
                                                             -> dependency plan
                                                             -> serial capability pipeline
                                                             -> PluginScope ownership
```

Endpoint probes within one remote/resource group may run in parallel with independent abort
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
| Business model | Add an API model plus one capability module; optionally add a typed contribution channel | candidate providers, dependency planner, runtime engine |
| Host-only UI/platform operation | Add a narrow gateway interface and inject its host adapter | public plugin model, runtime kernel |

Application code reads declarative models through `PluginStore.modelEntries()` or a typed
`ContributionHub` channel. It must not recreate origin-specific registries. There is no fallback
`Global`, booter registry, loader registry, or compatibility export layer; adding one would create a
second ownership model and violate this architecture.
