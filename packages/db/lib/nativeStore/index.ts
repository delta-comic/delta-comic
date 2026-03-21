import { SourcedValue } from '@delta-comic/model'
import { useLocalStorage } from '@vueuse/core'
import { toValue, type MaybeRefOrGetter } from 'vue'

const saveKey = new SourcedValue<[namespace: string, key: string]>()
export const useNativeStore = <T extends object>(
  namespace: string,
  key: MaybeRefOrGetter<string>,
  defaultValue: MaybeRefOrGetter<T>
) => {
  return useLocalStorage(saveKey.toString([namespace, toValue(key)]), defaultValue)
  //   return useStorageAsync<T>(saveKey.toString([namespace, toRef(key).value]), defaultValue, {
  //
  //   },
  //   async getItem(key) {
  //
  //   },
  //   async setItem(key, value) {
  //
  //   }
  // })
}