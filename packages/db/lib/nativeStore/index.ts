import { logger } from '@delta-comic/logger'
import { SourcedValue } from '@delta-comic/model'
import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

const nativeStoreLogger = logger.scoped('db:native-store')

export interface Table {
  namespace: string
  key: string
  value: string
}

const saveKey = new SourcedValue<[namespace: string, key: string]>()

const cloneDefault = <T extends object>(defaultValue: MaybeRefOrGetter<T>): T => {
  const value = toValue(defaultValue)
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

const legacyValue = (namespace: string, key: string) => {
  try {
    return globalThis.localStorage?.getItem(saveKey.toString([namespace, key])) ?? null
  } catch {
    return null
  }
}

const parseValue = <T extends object>(value: unknown, defaultValue: MaybeRefOrGetter<T>): T => {
  if (value === null || value === '') return cloneDefault(defaultValue)
  if (typeof value !== 'string') {
    if (typeof structuredClone === 'function') return structuredClone(value as T)
    return JSON.parse(JSON.stringify(value)) as T
  }
  try {
    return JSON.parse(value) as T
  } catch (error) {
    nativeStoreLogger.warn('failed to parse native store value', error)
    return cloneDefault(defaultValue)
  }
}

const getStoreValue = async (namespace: string, key: string) => {
  const { db } = await import('../index')
  return (
    (
      await db
        .selectFrom('nativeStore')
        .select('value')
        .where('namespace', '=', namespace)
        .where('key', '=', key)
        .executeTakeFirst()
    )?.value ?? null
  )
}

const setStoreValue = async (namespace: string, key: string, value: string) => {
  const { db } = await import('../index')
  await db.replaceInto('nativeStore').values({ namespace, key, value }).execute()
}

export const useNativeStore = <T extends object>(
  namespace: string,
  key: MaybeRefOrGetter<string>,
  defaultValue: MaybeRefOrGetter<T>,
) => {
  const state = ref(cloneDefault(defaultValue)) as Ref<T>
  let version = 0
  let hydrated = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const persist = (resolvedKey: string, value: T) => {
    if (saveTimer) clearTimeout(saveTimer)
    const encoded = JSON.stringify(value)
    saveTimer = setTimeout(() => {
      void setStoreValue(namespace, resolvedKey, encoded).catch(error => {
        nativeStoreLogger.warn(
          'failed to persist native store value',
          { key: resolvedKey, namespace },
          error,
        )
      })
    }, 100)
  }

  const load = async () => {
    const current = ++version
    const resolvedKey = toValue(key)
    hydrated = false
    try {
      const storeValue = await getStoreValue(namespace, resolvedKey)
      const storedValue = storeValue ?? legacyValue(namespace, resolvedKey)
      if (current !== version) return
      state.value = parseValue(storedValue, defaultValue)
      nativeStoreLogger.debug('native store value hydrated', {
        key: resolvedKey,
        namespace,
        source: storeValue === null ? 'legacy-or-default' : 'database',
      })
      hydrated = true
      if (storeValue === null) persist(resolvedKey, state.value)
    } catch (error) {
      nativeStoreLogger.warn(
        'failed to load native store value',
        { key: resolvedKey, namespace },
        error,
      )
      if (current !== version) return
      state.value = cloneDefault(defaultValue)
      hydrated = true
    }
  }

  watch(
    () => toValue(key),
    () => void load(),
    { immediate: true },
  )
  watch(
    state,
    value => {
      if (!hydrated) return
      persist(toValue(key), value)
    },
    { deep: true },
  )

  return state
}