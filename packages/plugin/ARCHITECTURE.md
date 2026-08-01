# Plugin architecture

The client plugin package uses a directed dependency graph. Code is grouped by responsibility,
and only the composition root may assemble concrete adapters and application services.

```text
api <- kernel <- runtime / install
        ^            ^
        |            |
   capabilities   adapters

builtins -> api
composition -> capabilities / adapters / runtime / install / builtins
index -> public API and read-only facades
```

## Import rules

- `api` contains the plugin author contract and pure helpers.
- `kernel` contains source-agnostic primitives such as candidates, scopes, contributions, and
  capability modules.
- `runtime` and `install` depend on kernel ports instead of concrete persistence, UI, or platform
  implementations.
- `adapters` implement kernel ports and never import application services.
- `builtins` use the same public author contract as external plugins.
- `composition.ts` is the only place allowed to assemble capabilities, adapters, providers, and
  runtime services.
- `index.ts` is export-only. Package code must never import `@/index` or self-import
  `@delta-comic/plugin`.

Globs are reserved for homogeneous discovery, such as internal plugin definitions. Lifecycle and
capability order is always an explicit list in the composition root.

## Extension rule

A new business capability is implemented as a vertical module with its contract, registry view,
and activation behavior. It is then added once to the explicit capability list. The activation
pipeline itself must not gain plugin IDs, origins, or feature-specific branches.

Internal and installed plugins are normalized to `PluginCandidate` before dependency planning.
Everything after `candidate.load()` is source-agnostic and shares the same activation, rollback,
reload, and unload behavior.
