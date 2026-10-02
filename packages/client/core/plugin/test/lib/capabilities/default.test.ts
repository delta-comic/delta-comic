import { describe, expect, it, vi } from 'vitest'

import { ConfigPointer } from '../../../lib/api'
import {
  createDefaultCapabilities,
  pluginModelChannels,
  type PluginCapabilityServices,
} from '../../../lib/capabilities'
import { ActivationPipeline, ContributionHub, PluginScope } from '../../../lib/kernel'

describe('default plugin capabilities', () => {
  it('activates declarative contributions and rolls every registration back with the scope', async () => {
    const registeredConfigs = new Set<ConfigPointer>()
    const messages = new Map<string, object>()
    const contributions = new ContributionHub()
    const services: PluginCapabilityServices = {
      config: {
        register(pointer) {
          registeredConfigs.add(pointer)
          return { ready: Promise.resolve() }
        },
        unregister: pointer => void registeredConfigs.delete(pointer),
      },
      contributions,
      i18n: {
        register: (plugin, value) => void messages.set(plugin, value),
        remove: plugin => void messages.delete(plugin),
      },
    }
    const scope = new PluginScope('example')
    const onBooted = vi.fn()
    const onUnload = vi.fn()
    const config = new ConfigPointer(
      'example',
      { enabled: { defaultValue: true, info: 'enabled', type: 'switch' } },
      'example.config',
    )

    const activated = await new ActivationPipeline(createDefaultCapabilities(services)).activate(
      {
        config,
        hooks: { onBooted, onUnload },
        i18n: { en: { title: 'Example' } },
        model: { social: { share: { initiative: [], tokenListen: [] } } },
        name: 'example',
      },
      { owner: 'example', report: vi.fn(), scope, signal: scope.signal },
    )

    expect(activated).toEqual(['config', 'i18n', 'model', 'lifecycle'])
    expect(registeredConfigs).toContain(config)
    expect(messages.has('example')).toBe(true)
    expect([...contributions.channel(pluginModelChannels.social).values()]).toHaveLength(1)
    expect(onBooted).toHaveBeenCalledOnce()

    await scope.dispose()

    expect(registeredConfigs.size).toBe(0)
    expect(messages.size).toBe(0)
    expect([...contributions.channel(pluginModelChannels.social).values()]).toHaveLength(0)
    expect(onUnload).toHaveBeenCalledOnce()
  })

  it('rejects config pointers owned by another plugin', async () => {
    const services: PluginCapabilityServices = {
      config: { register: vi.fn(), unregister: vi.fn() },
      contributions: new ContributionHub(),
      i18n: { register: vi.fn(), remove: vi.fn() },
    }
    const scope = new PluginScope('example')

    await expect(
      new ActivationPipeline(createDefaultCapabilities(services)).activate(
        {
          config: new ConfigPointer(
            'other',
            { enabled: { defaultValue: true, info: 'enabled', type: 'switch' } },
            'other.config',
          ),
          name: 'example',
        },
        { owner: 'example', report: vi.fn(), scope, signal: scope.signal },
      ),
    ).rejects.toThrow('plugin config owner mismatch')
  })
})