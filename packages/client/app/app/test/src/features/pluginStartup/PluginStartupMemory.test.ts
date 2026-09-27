import { describe, expect, it } from 'vite-plus/test'

import { PluginStartupMemory } from '../../../../src/features/pluginStartup/PluginStartupMemory'

const createStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

describe('plugin startup memory', () => {
  it('persists a unique plugin selection and safe mode', () => {
    const memory = new PluginStartupMemory(createStorage())
    memory.remember(['reader', 'reader', 'sync'], true)
    expect(memory.read()).toEqual({ pluginNames: ['reader', 'sync'], safe: true, version: 1 })
  })

  it('removes invalid persisted values', () => {
    const storage = createStorage()
    storage.setItem('delta-comic:plugin-startup', '{"version":1,"safe":"yes"}')
    const memory = new PluginStartupMemory(storage)
    expect(memory.read()).toBeNull()
    expect(storage.getItem('delta-comic:plugin-startup')).toBeNull()
  })
})