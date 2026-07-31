import { describe, expect, it } from 'vite-plus/test'

import { PluginRuntimeExtensions } from '../../../lib/driver/extensions'
import type {
  PluginBooter,
  PluginInstaller,
  PluginLoader,
} from '../../../lib/driver/extensionTypes'

const booter = (name: string) => ({ name }) as PluginBooter
const installer = (name: string) => ({ name }) as PluginInstaller
const loader = (name: string) => ({ name }) as PluginLoader

describe('plugin runtime extension registry', () => {
  it('orders each extension kind with its runtime precedence', () => {
    const registry = new PluginRuntimeExtensions()
    registry.registerBooter(booter('late'), { order: 20 })
    registry.registerBooter(booter('early'), { order: 10 })
    registry.registerLoader(loader('zip'), { order: 10 })
    registry.registerLoader(loader('dev'), { order: 20 })
    registry.registerInstaller(installer('fallback'), { order: 10 })
    registry.registerInstaller(installer('specific'), { order: 20 })

    expect(registry.booters.values.map(value => value.name)).toEqual(['early', 'late'])
    expect(registry.loaders.values.map(value => value.name)).toEqual(['zip', 'dev'])
    expect(registry.installers.values.map(value => value.name)).toEqual(['specific', 'fallback'])
  })

  it('restores overridden extensions when an owning plugin is removed', async () => {
    const registry = new PluginRuntimeExtensions()
    registry.registerLoader(loader('zip'), { order: 10 })
    await registry.withOwner('override', async () => {
      registry.registerLoader(loader('zip'), { order: 100 })
    })

    const overridden = registry.loaders.values[0]
    registry.removeOwner('override')

    expect(registry.loaders.values[0].name).toBe('zip')
    expect(registry.loaders.values[0]).not.toBe(overridden)
  })
})