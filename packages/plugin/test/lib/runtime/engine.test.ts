import { describe, expect, it, vi } from 'vitest'

import {
  createDefaultCapabilities,
  pluginModelChannels,
  type PluginCapabilityServices,
} from '../../../lib/capabilities'
import { ContributionHub, type PluginCandidateProvider } from '../../../lib/kernel'
import { PluginRuntime } from '../../../lib/runtime'

const manifest = (id: string, require: string[] = []) => ({
  apiVersion: 1 as const,
  author: 'test',
  description: 'test',
  name: { display: id, id },
  require: require.map(dependency => ({ id: dependency })),
  version: { plugin: '1.0.0', supportCore: '*' },
})

describe('PluginRuntime', () => {
  it('activates all candidate origins through one pipeline and disposes their channels on reload', async () => {
    const contributions = new ContributionHub()
    const services: PluginCapabilityServices = {
      config: { register: vi.fn(), unregister: vi.fn() },
      contributions,
      i18n: { register: vi.fn(), remove: vi.fn() },
      phase: 'normal',
    }
    let generation = 0
    const provider: PluginCandidateProvider = {
      id: 'test',
      list: async () =>
        ['core-addon', 'reader'].map((id, index) => ({
          enabled: true,
          load: async () => ({
            factory: () => ({
              model: { social: { share: { initiative: [], tokenListen: [] } } },
              name: id,
            }),
          }),
          management: { canDisable: true, canUninstall: index > 0, canUpdate: index > 0 },
          manifest: manifest(id),
          origin: index === 0 ? ('builtin' as const) : ('installed' as const),
        })),
    }
    const runtime = new PluginRuntime({
      capabilities: phase => createDefaultCapabilities({ ...services, phase }),
      environment: () => ({ platform: 'web', safe: true }),
      provider,
      remove: vi.fn(),
    })

    const first = runtime.loadNormal()
    expect((await first.operation).activated).toEqual(['core-addon', 'reader'])
    expect([...contributions.channel(pluginModelChannels.social).values()]).toHaveLength(2)
    generation += 1

    const second = runtime.reloadNormal()
    expect((await second.operation).activated).toEqual(['core-addon', 'reader'])
    expect([...contributions.channel(pluginModelChannels.social).values()]).toHaveLength(2)
    expect(generation).toBe(1)
  })

  it('does not activate dependents after a dependency fails', async () => {
    const dependentFactory = vi.fn(() => ({ name: 'dependent' }))
    const provider: PluginCandidateProvider = {
      id: 'test',
      list: async () => [
        {
          enabled: true,
          load: async () => {
            throw new Error('broken entry')
          },
          management: { canDisable: true, canUninstall: true, canUpdate: true },
          manifest: manifest('dependency'),
          origin: 'installed',
        },
        {
          enabled: true,
          load: async () => ({ factory: dependentFactory }),
          management: { canDisable: true, canUninstall: true, canUpdate: true },
          manifest: manifest('dependent', ['dependency']),
          origin: 'installed',
        },
      ],
    }
    const runtime = new PluginRuntime({
      capabilities: phase =>
        createDefaultCapabilities({
          config: { register: vi.fn(), unregister: vi.fn() },
          contributions: new ContributionHub(),
          i18n: { register: vi.fn(), remove: vi.fn() },
          phase,
        }),
      environment: () => ({ platform: 'web', safe: true }),
      provider,
      remove: vi.fn(),
    })

    const report = await runtime.loadNormal().operation

    expect(report.failures.map(value => value.plugin)).toEqual(['dependency', 'dependent'])
    expect(dependentFactory).not.toHaveBeenCalled()
  })
})