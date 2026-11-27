export interface ModuleSpec {
  package: string
  exports: readonly string[]
  externals: readonly string[]
}

export type RequireModule = (request: string) => object
export type ModuleFactory = (require: RequireModule) => unknown
export interface Registration {
  package: string
  factory: ModuleFactory
}
export interface ModuleEntry extends ModuleSpec {
  factory: ModuleFactory
}
export interface ModuleExports {
  modules: Record<string, object>
  components: readonly unknown[]
}

function validExports(value: unknown, paths: readonly string[]): value is ModuleExports {
  if (!value || typeof value !== 'object' || !('modules' in value) || !('components' in value))
    return false
  const { modules, components } = value
  return (
    !!modules &&
    typeof modules === 'object' &&
    !Array.isArray(modules) &&
    Array.isArray(components) &&
    components.every(fn => typeof fn === 'function') &&
    Object.keys(modules).length === paths.length &&
    paths.every(
      path =>
        Object.hasOwn(modules, path) &&
        typeof Reflect.get(modules, path) === 'object' &&
        Reflect.get(modules, path) !== null,
    )
  )
}

export function packageOf(request: string) {
  return request
    .split('/')
    .slice(0, request.startsWith('@') ? 2 : 1)
    .join('/')
}

interface Generation {
  result?: ModuleExports
  requests: Set<string>
}

export class ModuleRegistry {
  readonly #entries = new Map<string, ModuleEntry>()
  readonly #cache = new Map<string, Generation>()
  readonly #consumers = new Map<string, Set<string>>()
  readonly #switching = new Set<string>()
  readonly #stack: string[] = []
  readonly #seed: ReadonlyMap<string, object>

  constructor(seed: ReadonlyMap<string, object>) {
    this.#seed = new Map(seed)
  }

  register(entry: ModuleEntry) {
    if (this.#entries.has(entry.package)) throw new Error(`already registered: ${entry.package}`)
    this.#entries.set(entry.package, entry)
  }

  requests(name: string) {
    return [...(this.#cache.get(name)?.requests ?? [])]
  }

  evaluate(name: string): ModuleExports {
    const current = this.#cache.get(name)
    if (current?.result) return current.result
    if (current) throw new Error(`module cycle: ${[...this.#stack, name].join(' → ')}`)
    const entry = this.#entries.get(name)
    if (!entry) throw new Error(`unregistered package: ${name}`)
    const state: Generation = { requests: new Set() }
    this.#cache.set(name, state)
    this.#stack.push(name)
    try {
      const value = entry.factory(request => {
        if (this.#cache.get(name) !== state) throw new Error(`stale module generation: ${name}`)
        if (!entry.externals.includes(request))
          throw new Error(`${name}: undeclared request ${request}`)
        const host = this.#seed.get(request)
        if (host) return host
        const provider = packageOf(request)
        if (this.#switching.has(provider) && !this.#switching.has(name))
          throw new Error(`plugin update in progress: ${provider}`)
        const modules = this.evaluate(provider).modules
        const path = '.' + request.slice(provider.length)
        if (!Object.hasOwn(modules, path)) throw new Error(`${name}: missing export ${request}`)
        state.requests.add(request)
        const consumers = this.#consumers.get(provider) ?? new Set<string>()
        consumers.add(name)
        this.#consumers.set(provider, consumers)
        return modules[path]
      })
      if (!validExports(value, entry.exports)) throw new Error(`invalid factory exports: ${name}`)
      state.result = value
      return value
    } catch (error) {
      this.#discard(name)
      throw error
    } finally {
      this.#stack.pop()
    }
  }

  #discard(name: string) {
    for (const request of this.requests(name)) {
      const provider = packageOf(request)
      const consumers = this.#consumers.get(provider)
      consumers?.delete(name)
      if (!consumers?.size) this.#consumers.delete(provider)
    }
    this.#cache.delete(name)
  }

  // Capture and revoke every affected generation synchronously, before fiber disposal yields.
  freeze(roots: Iterable<string>) {
    const order = new Set<string>()
    const visit = (name: string) => {
      if (order.has(name)) return
      for (const consumer of this.#consumers.get(name) ?? []) visit(consumer)
      order.add(name)
    }
    for (const root of roots) visit(root)
    for (const name of order) {
      this.#switching.add(name)
      this.#discard(name)
      this.#entries.delete(name)
    }
    return [...order]
  }

  finish(names: Iterable<string>) {
    for (const name of names) this.#switching.delete(name)
  }
}