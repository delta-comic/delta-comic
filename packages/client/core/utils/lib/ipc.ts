import { logger } from '@delta-comic/shared-core-logger'

import { useGlobalVar } from './var'

const sharedFunctionLogger = logger.scoped('utils:shared-function')

export interface SharedFunctions {}

export class SharedFunction {
  private static sharedFunctions = useGlobalVar(
    new Map<string, { fn: SharedFunctions[keyof SharedFunctions]; plugin: string }[]>(),
    'utils/SharedFunction/sharedFunctions',
  )
  public static define<TKey extends keyof SharedFunctions>(
    fn: SharedFunctions[TKey],
    plugin: string,
    name: TKey,
  ) {
    sharedFunctionLogger.debug('shared function registered', { name, plugin })
    this.sharedFunctions.set(name, [...(this.sharedFunctions.get(name) ?? []), { fn, plugin }])
    return fn
  }
  public static call<TKey extends keyof SharedFunctions>(
    name: TKey,
    ...args: Parameters<SharedFunctions[TKey]>
  ) {
    const ins =
      this.sharedFunctions.get(name)?.map(v => {
        const result: ReturnType<SharedFunctions[TKey]> = (<any>v.fn)(...args)
        return { result, ...v }
      }) ?? []
    const results = Promise.all(ins.map(async v => ({ ...v, result: await v.result })))
    return Object.assign(ins, results)
  }
}