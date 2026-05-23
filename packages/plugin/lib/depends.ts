interface DependDefineConstraint<_T> {}
export type DependDefine<T> = symbol & DependDefineConstraint<T> & { _ts: T }

export const declareDepType = <T>(name: string) => <DependDefine<T>>Symbol.for(`expose:${name}`)

export const require = <T>(define: DependDefine<T>): T => pluginExposes.get(define)!

export type InferDependType<T extends DependDefine<any>> = T['_ts']

export const pluginExposes = new Map<symbol, any>()