import { reactive, shallowReactive, type Reactive } from 'vue'

import { useGlobalVar } from './var'

class TempStore {
  private readonly tempBase = shallowReactive(new Map<string, unknown>())

  $apply<T extends object>(id: string, def: () => T): Reactive<T> {
    const key = this.getReactiveKey(id)
    if (!this.tempBase.has(key)) this.tempBase.set(key, reactive(def()))
    return this.tempBase.get(key) as Reactive<T>
  }

  $has(id: string): boolean {
    return this.tempBase.has(this.getReactiveKey(id))
  }

  $onlyGet<T extends object>(id: string): Reactive<T> | undefined {
    return this.tempBase.get(this.getReactiveKey(id)) as Reactive<T> | undefined
  }

  $applyRaw<T extends object>(id: string, def: () => T): T {
    const key = this.getRawKey(id)
    if (!this.tempBase.has(key)) this.tempBase.set(key, def())
    return this.tempBase.get(key) as T
  }

  $hasRaw(id: string): boolean {
    return this.tempBase.has(this.getRawKey(id))
  }

  $onlyGetRaw<T extends object>(id: string): T | undefined {
    return this.tempBase.get(this.getRawKey(id)) as T | undefined
  }

  private getReactiveKey(id: string): string {
    return `reactive:${id}`
  }

  private getRawKey(id: string): string {
    return `raw:${id}`
  }
}

const temp = useGlobalVar(new TempStore(), 'store/temp')

export const useTemp = () => temp