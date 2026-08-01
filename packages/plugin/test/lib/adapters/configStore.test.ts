import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'

import { ConfigStore } from '../../../lib/adapters/configStore'
import { ConfigPointer } from '../../../lib/api'

const pointer = (name: string) =>
  new ConfigPointer(
    name,
    { enabled: { defaultValue: true, info: 'enabled', type: 'switch' } },
    `${name}.config`,
  )

describe('ConfigStore', () => {
  it('allows exactly one config definition per plugin and releases it by identity', () => {
    const store = new ConfigStore(config => ({
      data: shallowRef({ enabled: true }) as never,
      form: config.config,
      name: config.configName,
      ready: Promise.resolve(),
    }))
    const first = pointer('example')
    const duplicate = pointer('example')

    expect(store.register(first)).toBe(store.register(first))
    expect(() => store.register(duplicate)).toThrow('can only register one config')

    store.unregister(duplicate)
    expect(store.has(first)).toBe(true)
    store.unregister(first)
    expect(store.has(first)).toBe(false)
  })
})