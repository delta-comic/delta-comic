interface DependDefineConstraint<_T> {}
export type DependDefine<T> = symbol & DependDefineConstraint<T> & { _ts: T }

export const exposeSymbol = (name: string) => Symbol.for(`expose:${name}`)

export const declareDepType = <T>(name: string) => <DependDefine<T>>exposeSymbol(name)

export class DependencyRegistry {
  public constructor(public readonly exposes = new Map<symbol, unknown>()) {}

  public provide<T>(define: DependDefine<T>, value: T) {
    this.exposes.set(define, value)
    return value
  }

  public require<T>(define: DependDefine<T>): T {
    if (!this.exposes.has(define)) {
      const name = Symbol.keyFor(define) ?? define.description ?? define.toString()
      throw new Error(`not found plugin expose "${name}"`)
    }
    return this.exposes.get(define) as T
  }

  public has(define: DependDefine<unknown>) {
    return this.exposes.has(define)
  }

  public delete(define: DependDefine<unknown>) {
    return this.exposes.delete(define)
  }

  public clear() {
    this.exposes.clear()
  }
}

export type InferDependType<T extends DependDefine<any>> = T['_ts']

export const pluginExposes = new Map<symbol, unknown>()
export const defaultDependencyRegistry = new DependencyRegistry(pluginExposes)
export const createDependencyRegistry = () => new DependencyRegistry()

export const provide = <T>(define: DependDefine<T>, value: T) =>
  defaultDependencyRegistry.provide(define, value)

export const require = <T>(define: DependDefine<T>): T => defaultDependencyRegistry.require(define)