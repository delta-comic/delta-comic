interface DependDefineConstraint<_T> {}
export type DependDefine<T> = symbol & DependDefineConstraint<T>

export const declareDepType = <T>(name: string) => <DependDefine<T>>Symbol.for(`expose:${name}`)

export const require = <T>(define: DependDefine<T>): T => pluginExposes.get(define)!

export const pluginExposes = new Map<symbol, any>()