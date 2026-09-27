import type { PluginScope } from '../kernel'

interface MutableRegistry<TKey, TValue> {
  delete(key: TKey): boolean
  get(key: TKey): TValue | undefined
  has(key: TKey): boolean
  set(key: TKey, value: TValue): unknown
}

/** Bind a host registry entry and restore exactly the value that existed before activation. */
export const bindRegistryValue = <TKey, TValue>(
  scope: PluginScope,
  registry: MutableRegistry<TKey, TValue>,
  key: TKey,
  value: TValue | undefined,
) => {
  if (value === undefined) return
  const hadPrevious = registry.has(key)
  const previous = registry.get(key)
  registry.set(key, value)
  scope.defer(() => {
    if (hadPrevious) registry.set(key, previous as TValue)
    else registry.delete(key)
  })
}