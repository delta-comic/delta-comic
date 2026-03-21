import type { uni } from '@delta-comic/model'
import { useGlobalVar } from '@delta-comic/utils'
import { random } from 'es-toolkit/compat'

export interface SharedFunctions {
  getRandomProvide(signal?: AbortSignal): PromiseLike<uni.item.Item[]>

  routeToContent(
    contentType_: uni.content.ContentType_,
    id: string,
    ep: string,
    preload?: uni.content.PreloadValue
  ): PromiseLike<any>
  routeToSearch(
    input: string,
    source?: [plugin: string, name: string],
    sort?: string
  ): PromiseLike<any>

  triggerSharePopup(page: uni.content.ContentPage): PromiseLike<void>
  triggerShareToken(token: string): PromiseLike<void>
  pushShareToken(token: string): PromiseLike<void>
}

export class SharedFunction {
  private static sharedFunctions = useGlobalVar(
    new Map<string, { fn: SharedFunctions[keyof SharedFunctions]; plugin: string }[]>(),
    'utils/SharedFunction/sharedFunctions'
  )
  public static define<TKey extends keyof SharedFunctions>(
    fn: SharedFunctions[TKey],
    plugin: string,
    name: TKey
  ) {
    console.debug('[SharedFunction.define] defined new function', plugin, ':', name, '->', fn)
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
  public static callRandom<TKey extends keyof SharedFunctions>(
    name: TKey,
    ...args: Parameters<SharedFunctions[TKey]>
  ) {
    const all = this.sharedFunctions.get(name) ?? []
    const index = random(0, all.length - 1)
    const it = all[index]
    if (!it)
      throw new Error(`[SharedFunction.callRandom] call ${name}, but not resigner any function.`)
    console.log(`[SharedFunction.callRandom] call index: ${index} in ${all.length}`, it)
    const result: ReturnType<SharedFunctions[TKey]> = (<any>it.fn)(...args)
    const ins = { result, ...it }
    const results = (async () => ({ ...it, result: await result }))()
    return Object.assign(ins, results)
  }
  public static callWitch<TKey extends keyof SharedFunctions>(
    name: TKey,
    plugin: string,
    ...args: Parameters<SharedFunctions[TKey]>
  ) {
    const all = this.sharedFunctions.get(name) ?? []
    const them = all.filter(c => c.plugin === plugin)
    if (!them.length)
      throw new Error(
        `[SharedFunction.callWitch] not found plugin function (plugin: ${plugin}, name: ${name})`
      )

    const ins = them.map(v => {
      const result: ReturnType<SharedFunctions[TKey]> = (<any>v.fn)(...args)
      return { result, ...v }
    })
    const results = Promise.all(ins.map(async v => ({ ...v, result: await v.result })))
    return Object.assign(ins, results)
  }
}