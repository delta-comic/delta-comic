import { useGlobalVar } from '@delta-comic/utils'
import { defineStore } from 'pinia'
import { reactive, shallowReactive, type Reactive } from 'vue'

const _useTemp = useGlobalVar(
  defineStore('core:temp', helper => {
    const tempBase = shallowReactive(new Map<string, any>())
    const $apply = <T extends object>(id: string, def: () => T) => {
      id = `reactive:${id}`
      if (!tempBase.has(id)) tempBase.set(id, reactive(def()))
      const store: Reactive<T> = tempBase.get(id)
      return store
    }
    const $has = helper.action((id: string): boolean => {
      id = `reactive:${id}`
      return tempBase.has(id)
    }, 'has')
    const $onlyGet = helper.action(<T extends object>(id: string): Reactive<T> => {
      id = `reactive:${id}`
      return tempBase.get(id)
    }, 'onlyGet')
    const $applyRaw = helper.action(<T extends object>(id: string, def: () => T) => {
      id = `raw:${id}`
      if (!tempBase.has(id)) tempBase.set(id, def())
      const store: T = tempBase.get(id)
      return store
    }, 'applyRaw')
    const $hasRaw = helper.action((id: string): boolean => {
      id = `raw:${id}`
      return tempBase.has(id)
    }, 'hasRaw')
    const $onlyGetRaw = helper.action(<T extends object>(id: string): Reactive<T> => {
      id = `raw:${id}`
      return tempBase.get(id)
    }, 'onlyGetRaw')
    return { $apply, $has, $onlyGet, $applyRaw, $hasRaw, $onlyGetRaw }
  }),
  'store/temp'
)

export const useTemp = () => _useTemp(window.$api.piniaInstance)