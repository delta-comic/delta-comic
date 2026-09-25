---
name: cordis
description: Use when writing, loading, composing, hot-reloading, or debugging Cordis framework plugins — plugin shapes and export conventions, context/services/inject, effects and disposal, typed events and dispatch modes (especially waterfall pipelines), config schemas, loader composition and entry options, timer/HMR helpers, PENDING-fiber diagnosis, and Service Definition templates. Pure-framework knowledge only; for repository-owned services and events use the generated subsystem pages instead.
---

# Cordis framework

Distilled from the Cordis documentation ([docs/cordis-primer.md](../../../docs/cordis-primer.md), [docs/cordis-api/](../../../docs/cordis-api/context.md), [docs/cordis-tutorial/](../../../docs/cordis-tutorial/index.md)) and the framework source, cross-checked against field-tested usage patterns. Everything below is about the framework itself and uses the upstream names throughout: the `cordis` core package and its `@cordisjs/plugin-*` companions.

Version calibration: every claim was verified against the upstream `cordiverse/cordis` sources on the 4.x release-candidate line (npm publishes this line as `cordis@4.0.0-rc.*`); upstream marks the API as not yet stable.

## The core model

- **A plugin is an object that implements `Plugin`**: a function with optional metadata fields, a class, or an object with an `apply(ctx, config)` method. Its lifecycle Cordis mounts into the current context.
- **A context is a repository of services.** A service claims a stable `ctx.<key>` property; consumers find services by key instead of importing a concrete implementation, so configuration can swap providers without touching consumers.
- **Declare dependencies via `inject`.** A plugin that names required services waits (state PENDING) until all exist; load order comes from service requirements, never manual boot sequencing or file position.
- **Typed events for communication**, dispatched as `emit`, `waterfall`, `parallel`, `serial`, or `bail`.
- **Registrations are reversible effects.** Listeners, child plugins, services, timers, and anything wrapped in `ctx.effect()` unwind predictably on reload and teardown.

## Plugin shapes and module conventions

```ts
// 1. Function plugin — most common form.
export function apply(ctx: Context) {}

// 2. Namespace plugin — named exports carry metadata alongside apply.
export const name = 'my-plugin'
export const inject = ['counter']
export interface Config {
  greeting: string
}
export const Config: Schema<Config> = Schema.object({ greeting: Schema.string() })
export function apply(ctx: Context, config: Config) {
  ctx.logger.info('%s', config.greeting)
}

// 3. Class plugin — a Service subclass (see Services below).
export class MyService extends Service {
  constructor(ctx: Context) { super(ctx, 'myService') }
}
```

Metadata fields recognized by loaders and the registry (`Plugin.Base`): `name?`, `Config?` (a [Standard Schema](https://standardschema.dev/) validator applied before `apply` runs), `inject?: Inject`, `provide?: string | string[]`, `intercept?: Dict<boolean>`. A function plugin needs no `apply` wrapper — Cordis calls it directly; `apply` is required only for object form. A function literally named `apply` is treated as unnamed in diagnostics.

**Export-shape rule (field-tested failure mode): namespace form and `export default` are mutually exclusive under the loader.** The loader unwraps modules as `exports.default ?? exports` (with an ESM/CJS interop step). A stray `export default apply` next to named exports makes the loader unwrap to the bare function and discard the namespace's `inject`/`name`/`Config` — the fiber then loads with empty inject, and the first undeclared `ctx.someService` read throws `cannot get property "someService" without inject`. Pick one form; if you need metadata, use named exports only. Note that hand-built tests using `ctx.plugin({ inject, ... })` bypass module unwrapping entirely — only real-loader loading exercises export-shape bugs.

Quick start (pure runtime, no loader):

```ts
import { Context, Service } from 'cordis'

declare module 'cordis' {
  interface Context { counter: Counter }
  interface Events { 'app/ready'(message: string): void }
}

class Counter extends Service {
  value = 0
  constructor(ctx: Context) { super(ctx, 'counter') }
  next() { return ++this.value }
}

const greeter = Object.assign((ctx: Context) => {
  ctx.on('app/ready', (message) => ctx.logger.info('%s #%d', message, ctx.counter.next()))
}, { inject: ['counter'] })

const root = new Context()
await root.plugin(Counter)
await root.plugin(greeter)
root.emit('app/ready', 'started')
await root.fiber.dispose()
```

## Lifecycle and effects

Every loaded plugin instance owns a **fiber** moving through:

```
PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED
                  ↘ FAILED
```

PENDING = declared but a required service is missing; LOADING/ACTIVE = `apply` running/done; FAILED = `apply` or config validation threw; UNLOADING/DISPOSED = disposers running/everything torn down. State transitions emit `internal/status`.

Effects: `ctx.effect(execute, label?)` runs `execute` immediately and collects its disposers, running them in reverse order when the returned disposer is called or the fiber unloads, whichever comes first. Accepted effect bodies:

```ts
ctx.effect(() => {
  const handle = openResource()
  return () => handle.close()          // plain disposer
})

ctx.effect(async () => {                // promise of a disposer
  const handle = await connectAsync()
  return () => handle.close()
})

ctx.effect(function* () {               // generator yielding disposers
  yield subscribe('a')
  yield subscribe('b')                 // each yield registers one more disposer
})
```

Calling the returned disposer twice is a no-op. Throws `CordisError('INACTIVE_EFFECT')` ("cannot create effect on inactive context") on a disposed/unloading fiber and `TypeError` for an invalid shape. An optional `label` appears in `fiber.getEffects()` diagnostics (`EffectMeta` trees of nested labels) — pass one like `'ctx.timeout()'` when wrapping helpers; unlabeled effects show as `'anonymous'`.

Already-effects you rarely wrap manually:

- `ctx.on()` / `ctx.once()` listeners — removed on unload.
- `ctx.plugin(child)` — the child is disposed with its parent, recursively.
- `Service` registrations — removed with the owning fiber.
- Timer helpers (below) — auto-cleared when the current fiber unloads.

Disposal ordering caveat: disposers start in reverse registration order, but multiple **async** disposers run concurrently. If teardown steps must run sequentially, keep them inside one disposer and await them there.

Unloading happens on config edit, hot reload, explicit `fiber.dispose()`, or loss of a required service. A plugin that throws during load fails loud — the process dies with the error, it is not skipped. One exception: a config entry whose *module cannot be resolved* (typo'd path/package) is reported through the logger service instead of crashing, and that report can be lost before a console exporter watches — check spelling first when a fresh entry does nothing.

Class plugins run in three steps: construct `new Callback(ctx, config)`, run any `@Inject`-decorated init hooks (deferred until injected services are ready), then call `instance[Service.init]()` and use its result as an effect body. The async-generator form is the field-tested template for setup/teardown pairing:

```ts
import { Service } from 'cordis'
import type { Disposable } from 'cordis'

class Watcher extends Service {
  static inject = ['timer']
  constructor(ctx: Context) { super(ctx, 'watcher') }

  async *[Service.init](): AsyncGenerator<Disposable> {
    const handle = startWatching(this.ctx)
    yield () => handle.close()           // runs when the service unloads
  }
}
```

## Services

A service is a named capability one plugin provides and others consume through `ctx`. Two coordinated pieces:

```ts
import { Service, type Context } from 'cordis'

declare module 'cordis' {
  interface Context { greeter: GreeterService }   // compile-time only
}

export class GreeterService extends Service {
  constructor(ctx: Context) { super(ctx, 'greeter') } // runtime registration
  greet(who: string) { return `Hello, ${who}!` }
}

export function apply(ctx: Context) { ctx.plugin(GreeterService) }
```

- Runtime: `super(ctx, 'greeter')` calls `ctx.reflect.provide('greeter', this)`; the registration is an effect removed with the provider. The constructor takes only `(ctx, name)` — store config on your own field; omitting the name falls back to a static `provide` property on the subclass.
- Compile time: declaration merging adds `greeter` to `Context` so `ctx.greeter` typechecks; without it the service still runs but consumers lose type safety. In another file, `import type {} from './provider.ts'` pulls merges in with zero runtime cost.

Consuming: `export const inject = ['greeter']` holds the consumer in PENDING until the service exists, so `apply` can rely on `ctx.greeter`. Dependency tracking continues after load: if a required service disappears (provider unloaded or hot-replaced), every dependent unloads too and reloads when the service returns — so consumers never retain references to unavailable services, and swapping providers cleanly restarts dependents.

**Property reads are strict.** Reading `ctx.someName` walks the fiber chain ancestor-only through the proxy: store hit → value; missing while inactive → error; nothing found → throws `cannot get property "someName" without inject`. A service provided by a *sibling branch* of the plugin tree is invisible to property reads even though it exists globally. Two consequences:

- Reserve `ctx.<name>` reads for declared injections (they guarantee reachability).
- Probe opportunistic/optional services with `ctx.get('name')`, which consults the topology-independent isolate-keyed store and returns `undefined` when absent (pass `strict: false` to include inactive providers):

```ts
export const inject = ['core']
export function apply(ctx: Context, config: Config) {
  const creds = ctx.get('credentials')
  if (creds !== undefined) enableAuth(creds)
}
```

Naming: service names live in one flat namespace per application — prefix your own distinctively.

Low-level store APIs (mixed onto ctx via the reflect layer):

- `ctx.get(name, strict?)`, `ctx.set(name, value)` (only the providing fiber may set; throws otherwise).
- `ctx.provide(name, value)` → disposer; throws if already provided in scope.
- `ctx.accessor(name, { get, set? })` — computed property, removed on unload.
- `ctx.mixin(serviceName, keys | map)` — forwards members onto ctx (e.g. how `ctx.on` forwards to `ctx.events.on`, how the timer package exposes `ctx.timeout`); removed on unload.

`Service` static symbol hooks (rarely needed): `Service.init` (post-construction effect body, above), `Service.check` (availability predicate passed to provide), `Service.config` (phantom intercept-config type param), `Service.invoke` (callable-service body, e.g. `ctx.logger('name')` returns a callable facade), `Service.extend`, `Service.tracker`, `Service.resolveConfig` (merges intercept config from ancestors).

Inject supports intercept config per dependency and comes in two forms (a union — do not mix): `['a']` requests services without intercept config; `{ b: { option: true } }` maps each service name to intercept config merged into that plugin's view of the named service. `@Inject(name, config?)` decorators do the same for classes and methods (decorated methods are deferred until the named services are ready).

## Events

Declare event names through `interface Events` merging, using the `namespace/action` convention (field practice: `<package-name>/<action>`) to keep the flat namespace readable:

```ts
declare module 'cordis' {
  interface Events {
    /** @mode emit */ 'stats/report'(name: string, count: number): void
    /** @mode waterfall */ 'demo/transform'(input: string, next: () => Promise<string>): Promise<string>
  }
}
```

Dispatch modes — the mode is part of an event's public contract; dispatch only through the matching method:

| Mode | Call | Awaited | Order | Return |
|---|---|---|---|---|
| `emit` | `ctx.emit(name, ...args)` | no | registration order | none (sync broadcast; promises/values ignored) |
| `waterfall` | `ctx.waterfall(name, ...args)` | no | registration order | outermost listener's return |
| `parallel` | `await ctx.parallel(...)` | yes | concurrent | none; rejections surface as `AggregateError` of all failures |
| `serial` | `await ctx.serial(...)` | yes | registration order | first bail value |
| `bail` | `ctx.bail(...)` | no | registration order | first bail value |

"Bail" means the first non-`null`/non-`false`/non-`undefined` return stops later listeners. `type DispatchMode = 'emit' | 'parallel' | 'serial' | 'bail' | 'waterfall'`.

Listener registration: `ctx.on(name, listener, options?)` / `ctx.once(...)`, both returning a disposer (`true` if still registered). Options: `{ prepend?: boolean, global?: boolean }` — `prepend` adds before existing listeners; `global` bypasses context listener-filter checks; a bare boolean means `prepend`. Every dispatch method also has a thisArg-first overload (`ctx.emit(thisArg, name, ...args)`) used when dispatching against a specific context.

Choosing a mode (field-tested heuristics):

- **emit** — notifications and state-change broadcasts nobody answers (`agent/status`, `session/created`, `fs/observed`).
- **waterfall** — interceptable pipelines where listeners transform or veto a decision (`tools/pre-execute`, `storage/write-intent`, `llm/stream`, `approval/request`).
- **serial** — orderly awaited steps where sequence matters (shutdown phases).
- **parallel** — independent fan-out work (flushes, exporters).

Waterfall is around-middleware. Each listener receives `(...args, next)`; call `next()` to invoke the rest of the chain (finally the built-in behavior passed as the last argument at the dispatch site) and transform its result; return without calling `next()` to veto/short-circuit.

The field-tested pipeline pattern puts the default behavior at the dispatch site as the trailing fallback and uses the event as a single-slot decision:

```ts
declare module 'cordis' {
  interface Events {
    /**
     * Decide whether a write may proceed.
     * @param target - file being written
     * @param actor - caller description
     * @param next - default: allow (undefined intent)
     * @mode waterfall
     */
    'storage/write-intent'(target: Target, actor: Actor, next: () => Intent | undefined): Promise<Intent | undefined>
  }
}

// Producer: last argument is the default next().
const intent = await ctx.waterfall('storage/write-intent', target, actor, () => undefined)

// Consumer/policy plugin: decide or delegate.
ctx.on('storage/write-intent', (target, actor, next) => {
  if (target.path.startsWith('/etc')) return { kind: 'deny', reason: 'system path' }
  return next()
})
```

First listener returning an intent owns the decision; observers must call `next()`.

Discipline: **a waterfall listener that only observes or annotates MUST call `next()`** — forgetting it silently swallows the default behavior for everything downstream. Short-circuiting is reserved for listeners that own the decision. Use `prepend: true` only when a listener must run before ordinary registrations.

Two advanced hooks worth knowing:

- Listeners registered on `internal/update` without `{ global: true }` become **per-fiber hooks**: they fire only for their own fiber's config updates and are auto-removed on unload — the idiomatic way to react to your own reconfiguration.
- `internal/listener` is a bail event around every registration; returning a non-null value replaces the registration (this is how HMR re-binds listeners across reloads).

## Configuration

Export `Config` as a Standard Schema validator (e.g. Schemastery); a plain object will not work. Cordis validates before `apply`, so `apply` always receives complete config (schema defaults filled):

```ts
import Schema from 'schemastery'

export interface Config {
  /** Greeting prefix. Default: Hello */
  greeting: string
  retryPolicy: RetryPolicy
  credentialsRef?: string
}
export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  retryPolicy: RetryPolicySchema,                       // compose leaf schemas directly
  credentialsRef: Schema.string().role('secret'),
})
export function apply(ctx: Context, config: Config) {}
```

Useful Schemastery pieces seen in practice: `.required()`, `.default(x)`, `.min/.max/.step` on numbers, `Schema.union(['a', 'b'])` for literals, `Schema.array(sub)`, `Schema.object({})`, `Schema.intersect([a.Config, b.Config])` for composing sub-plugin configs, and the empty-config idiom `Schema.object({}) as unknown as Schema<Config>` for plugins that take none.

Invalid config fails the load with a `ValidationError extends TypeError` aggregating schema issues (one line each, e.g. `$.targets expected array but got …`); the fiber goes FAILED and `fiber.await()` rethrows. Beyond schema validity, reject config naming an unavailable resource/provider as soon as the reference can be resolved — fail loud, never start half-configured. The field-tested shape is an explicit resolution step rather than scattered fallbacks:

```ts
function resolveAdapterOptions(config: Config): AdapterSpec {
  if (!config.endpoint && !config.discover) throw new Error('config requires endpoint or discover')
  return { ...config, endpoint: new URL(config.endpoint ?? DEFAULT_ENDPOINT) }
}
```

Computed config values: `!!js` tags parse into expression nodes evaluated via `with(ctx){ eval(expr) }` — identifiers resolve through the context prototype chain, so services visible to the loader context are readable inside expressions. Only an entry's `config` field interpolates, lazily after that entry's declared injections activate; entries carrying a nested list (group/include carriers) keep configs literal because each child row interpolates lazily in its own fiber. All other metadata (`id`, `name`, `inject`, `disabled`) stays literal, and raw expression nodes survive write-back so persisted files keep their expression form. When environment selects plugins, prefer overlays over expression tricks.

Runtime reconfiguration: `fiber.update(config, noSave?)` validates then restarts, running the `internal/update` waterfall first so update hooks can veto or replace the restart; `noSave` hints persistence hooks not to write back. Under the loader, a successful update is written back to the entry's config in the source file automatically (the loader persists unless `noSave`). `fiber.restart()` disposes and reloads with current config (the root fiber's `dispose()` is a restart).

## Composition and the loader

The loader mounts an application from a config file (typically `cordis.yml`, a list of entries):

```yaml
- id: greeter          # stable identity for diffing edits vs removal+addition
  name: './greeter.ts' # module specifier: relative path or npm package
  inject: ['logger']
- id: isolated-demo
  name: './demo.ts'
  isolate: true        # entry-local realm: own instance of every service name
- id: shared-cache
  name: './cache.ts'
  isolate: cache       # same label joins scopes across entries
  intercept:
    logger:
      level: debug
- id: consumer
  name: './consumer.ts'
  disabled: true       # keep the entry, skip mounting
```

Entry options: `id` (required, stable identity), `name` (module specifier), `config`, `inject` (extra dependencies merged into the loaded plugin's inject), `intercept` (intercept-config map applied to this entry's context), `isolate` (`true` = unique realm per entry; a string label = shared realm across entries with the same label), `group` (marks group carriers), `disabled`.

Behavior details worth internalizing:

- Entries start concurrently — list position guarantees nothing about load order; ordering comes from `inject`. A composition with only PENDING fibers exits 0 silently (PENDING does not keep the event loop alive).
- The loader diffs entries by `id`: unchanged entries stay mounted, edited `config` patches in place (context prototypes rebuilt + `fiber.update`), changed `name`/`inject`/`group` replace the plugin (dispose old fiber, import fresh), and failures roll back to the previous state with `failed to <apply|rollback> loader entry <id>: …`. Without an explicit id an entry gets a generated id per read, so any config-file edit remounts it even if its lines did not change.
- Groups nest sub-lists that load/unload as one unit; editing a group's list live-applies children diffed by id (duplicate ids → `duplicate loader entry id`; failed updates roll back created/removed children).
- Depending on `loader` with `{ await: true }` intercept config holds the consumer PENDING until all entries finish loading — useful for tools that must see the full tree at startup.
- Self-dispose is persistent: a plugin calling `ctx.fiber.dispose()` on its own entry-owned root fiber makes the loader set `disabled: true` on that entry and write it back — disposing yourself uninstalls you from the config, not just from memory.
- `fiber.update(config)` writes back to the config file (unless `noSave`) — runtime changes persist.
- Specifiers resolve relative to `ctx.baseUrl` (relative paths) or as bare npm imports; a `cordis:` prefix loads from host-registered `loader.builtins` instead of the module system. Nested entries get hierarchical ids (`<parentId>:<childId>`).

File-backed trees: `@cordisjs/plugin-include` mounts a YAML/JSON/module file as an entry list via `{ path }`. `initial` seeds the file when it is missing; writes are debounced atomic tmp-and-rename and emit `loader/config-update`; an unwritable file degrades to readonly. The optional `patches` list overlays declarative edits on the loaded data — `{ id, insert: [...] }` appends rows into the group entry with that id (or appends at the top level without `id`), while other patches override fields on the row matching `id`, with an optional `name` guard that skips mismatched targets. Patches are the stock mechanism for environment-specific composition overlays.

Hot module replacement: because unloading releases effects and loading follows dependencies, `@cordisjs/plugin-hmr` replaces running plugins on save (unload old instance — all effects unwound — then run new `apply`; the reload unit is the plugin's entry file). It logs through the logger service (mount `@cordisjs/plugin-logger-console` to see messages) and injects the `timer` service for debouncing (without `@cordisjs/plugin-timer` it sits PENDING silently). Changes outside watched roots can be wired in via `hmr.registerConfig(filename, refresh)`; emitted events include `hmr/change(url)` and `hmr/reload(reloads)`. Editing the config file itself is picked up with the same id-based diffing.

Timer helpers (mixed onto ctx by the timer package; auto-cleared when the fiber unloads):

```ts
const cancel = ctx.timeout(() => console.log('late'), 1000)   // returns a disposer
await ctx.timeout(5000)                                       // promise form: rejects if the fiber unloads first
for await (const tick of ctx.interval(1000)) {}               // interval iterator, same rejection semantics
const throttled = ctx.throttle(handler, 200)                  // wrapped fns carry .dispose()
const debounced = ctx.debounce(save, 100)
```

## Diagnosing a plugin that never loads

A plugin whose `inject` names a service nobody provides waits forever printing nothing — PENDING is legitimate since the provider may arrive later. Enumerate the registry to see states:

```ts
import { FiberState, type Context } from 'cordis'

export function apply(ctx: Context) {
  setTimeout(() => {
    for (const runtime of ctx.registry.values()) {
      for (const fiber of runtime.fibers) {
        if (fiber.state === FiberState.PENDING) {
          console.log(`${fiber.name} is PENDING — a required service is missing`)
        }
      }
    }
  }, 500)
}
```

Iterating without the filter also shows loader-internal plugins as ACTIVE fibers. Checklist ordered by observed frequency: missing provider for a declared inject; HMR/timer companion not mounted (HMR sits PENDING silently); export-shape bug (stray `export default` dropping namespace `inject`); typo'd module specifier (reported only via logger); reading a sibling-branch service through `ctx.x` instead of `ctx.get()`.

## Architecture templates (field-tested)

**Service Definition package** — declares the seam: merged `Context` + `Events` types, abstract `Service` subclass, default-exported class:

```ts
import { Context, Service } from 'cordis'

declare module 'cordis' {
  interface Context { storage: Storage }
  interface Events {
    /**
     * Decide whether a write may proceed.
     * @param target - write target
     * @param actor - caller description
     * @param next - default allow
     * @mode waterfall
     */
    'storage/write-intent'(target: Target, actor: Actor, next: () => Intent | undefined): Promise<Intent | undefined>
  }
}

export abstract class Storage extends Service {
  constructor(ctx: Context) { super(ctx, 'storage') }
  abstract read(path: string): Promise<string>
  async write(path: string, data: string, actor: Actor): Promise<void> {
    const target = targetOf(path)
    const intent = await this.ctx.waterfall('storage/write-intent', target, actor, () => undefined)
    if (intent?.kind === 'deny') throw new Error(`denied: ${intent.reason}`)
    return this.performWrite(path, data)
  }
  protected abstract performWrite(path: string, data: string): Promise<void>
}
```

**Provider implementation** — implements the abstract class, provides config, registers itself; swaps cleanly because consumers bind to the key:

```ts
import { Context, Service } from 'cordis'
import type { Storage } from './definition.ts'   // pulls in the declare merges

export class LocalStorage extends Storage {
  static inject = ['logger']
  constructor(ctx: Context, public config: LocalConfig) { super(ctx, 'storage') }
  async read(path: string) { ... }
  protected async performWrite(path: string, data: string) { ... }
}
```

**Consumer** — declares inject, listens on the Definition's events; policy lives in separate plugins so providers stay policy-free:

```ts
export const inject = ['storage']
export function apply(ctx: Context) {
  ctx.on('storage/write-intent', (target, _actor, next) => {
    if (target.path.startsWith('/etc')) return { kind: 'deny', reason: 'protected' }
    return next()
  })
}
```

**Live-updating registrations**: capture the registration handle once and refresh in place instead of dispose+re-register, avoiding windows where consumers see no route between the two operations:

```ts
const registration = ctx.llm.register(PROVIDER_V1)   // hypothetical registry API
// later, after config change:
registration.replace([PROVIDER_V2])
```

Other field-tested habits: degrade-with-last-good-config — keep operating on the previous valid snapshot and log each invalid one once instead of crashing; loggers accept printf-style formats (`ctx.logger.error('%s failed: %o', name, err)`; an Error as first arg prints its stack; `%C` colorizes by logger name).

## API quick reference

Ambient handles on every context: `ctx.root` (shared root, experimental), `ctx.events` (bus; methods mixed onto ctx), `ctx.logger(name?)`, `ctx.reflect`, `ctx.registry` (methods mixed: `ctx.plugin`, `ctx.inject`), `ctx.fiber`, `ctx.baseUrl` (relative-specifier resolution), plus loader-provided `ctx.loader`, `ctx.hmr`, and timer helpers `timeout/interval/throttle/debounce` (mixed via `ctx.mixin`; `ctx.timer` provided at runtime under the timer plugin). Loader service methods: `create(options, parent?, position?)`, `update(id, options, parent?, position?)` (also moves entries between groups), `remove(id)`, `resolve(id)` / `resolveGroup(id)` (nested `a:b` ids), `await()` (drains pending entry imports and fiber reloads), `locate(fiber?)`.

Context derivation: `extend(meta?)`, `isolate(name, label?)`, `intercept(name, config)` — all return children without mutating the parent; passing the same `label` to two `isolate()` calls joins their scopes. `Context.is(value)` brand-checks contexts across realms/copies via a global symbol. Static symbol keys: `Context.effect` (disposer EffectMeta tree), `Context.filter` (listener filter consulted on every dispatch), `Context.isolate`, `Context.intercept`.

Plugin loading: `ctx.plugin(plugin, ...configArgs)` returns a `Fiber & PromiseLike<Fiber>` — awaiting settles loading, rejecting on config/startup errors; passing an invalid shape throws immediately; `ctx.inject(deps, callback)` is shorthand for `ctx.plugin({ inject: deps, apply: callback })`, unloading and re-running the callback whenever a required service changes. All fibers of one callback share a `Plugin.Runtime` record (`name`, `fibers`, identity-key `callback`, `Config`); `registry.delete(plugin)` disposes all of them.

Fiber: `uid` (0 for root; `null` once disposed), `ctx`, `config`, `state`, `store` (required-service snapshot while loaded), `inertia` (in-flight transition), `entry` (loader entry when applicable), `dispose()` (resolves after all cleanup including async disposers and child teardown), `assertActive()` (throws INACTIVE_EFFECT), `effect()`, `getEffects()`, `await()` (drains in-flight transitions, rethrows startup errors), `restart()`, `update(config, noSave?)`, `name` getter (nearest named ancestor, else `'root'`).

Errors: `CordisError` carries a stable machine-readable `code` (`INACTIVE_EFFECT`); `ValidationError extends TypeError` aggregates Standard-Schema issues from config validation.

Internal events (core): `internal/plugin` (fiber created), `internal/status` (lifecycle change), `internal/service` (service-binding interception hook, no core producer), `internal/config` (waterfall resolving raw plugin config after injections activate), `internal/update` (waterfall during config update; non-global listeners become per-fiber hooks), `internal/get` / `internal/set` (waterfalls around proxy reads/writes), `internal/listener` (bail event replacing listener registrations), `internal/dispatch` (every non-internal dispatch, catch-all observation point). Companion packages add: `hmr/change`, `hmr/reload`, `hmr/config-update-failed`; `exit`; `loader/config-update`, `loader/entry-init`, `loader/partial-dispose`, `loader/patch-context`.

Official packages: `cordis` (core), `create-cordis` (scaffolder), `@cordisjs/plugin-loader` (runtime entry tree + persistence), `@cordisjs/plugin-include` (file-backed trees, `!!js`, patches), `@cordisjs/plugin-group`, `@cordisjs/plugin-hmr` (watches files, needs loader internals), `@cordisjs/plugin-logger-console`, `@cordisjs/plugin-timer`, `@cordisjs/utils`. ESM-first; Node 22+ for the scaffolder.

## Practical rules

Encapsulate behavior into plugins keyed to the owning capability's service; prefer events for interception and policy, service methods for direct calls. Every registration should have a disposer — return one from `ctx.effect()` or use a helper that does (timers already do); when teardown order matters, keep related work in one effect so disposal unwinds in sequence. Use TypeScript declaration merging (`declare module`) for every new `ctx.<key>` and event name, annotate each event's JSDoc with its dispatch mode, and import type-only side-effect imports (`import type {} from ...`) to share merges across files. Namespace plugins never also `export default`. Optional capabilities are probed with `ctx.get`, never read off `ctx` undeclared. Waterfall observers always `next()`. Config beyond schema bounds fails loud at the earliest resolvable point.
