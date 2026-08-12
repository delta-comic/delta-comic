import { describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'

import { createDefaultCapabilities } from '../../../lib/capabilities'
import {
  ContributionHub,
  type PluginCandidate,
  type PluginCandidateProvider,
} from '../../../lib/kernel'
import { PluginRuntime } from '../../../lib/runtime'

const manifest = (id: string, require: string[] = []) => ({
  apiVersion: 1 as const,
  author: 'test',
  description: 'test',
  name: { display: id, id },
  require: require.map(dependency => ({ id: dependency })),
  version: { plugin: '1.0.0', supportCore: '*' },
})

const candidate = (
  id: string,
  factory: PluginCandidate['load'],
  options: { canDisable?: boolean; enabled?: boolean; require?: string[] } = {},
): PluginCandidate => ({
  enabled: options.enabled ?? true,
  load: factory,
  management: { canDisable: options.canDisable ?? true, canUninstall: true, canUpdate: true },
  manifest: manifest(id, options.require),
  origin: 'installed',
})

const runtimeFor = (list: () => readonly PluginCandidate[]) =>
  new PluginRuntime({
    capabilities: () =>
      createDefaultCapabilities({
        config: { register: vi.fn(), unregister: vi.fn() },
        contributions: new ContributionHub(),
        i18n: { register: vi.fn(), remove: vi.fn() },
      }),
    environment: () => ({ platform: 'web' }),
    provider: { id: 'test', list: async () => list() } satisfies PluginCandidateProvider,
    remove: vi.fn(),
  })

describe('PluginRuntime', () => {
  it('preloads every enabled plugin but activates only selected normal parts', async () => {
    const app = {} as App
    const enabledPreload = vi.fn()
    const enabledBooted = vi.fn()
    const unselectedPreload = vi.fn()
    const unselectedBooted = vi.fn()
    const disabledFactory = vi.fn(() => ({ name: 'disabled' }))
    const runtime = runtimeFor(() => [
      candidate('enabled', async () => ({
        factory: () => ({
          hooks: { onBooted: enabledBooted, onPreboot: enabledPreload },
          name: 'enabled',
        }),
      })),
      candidate('unselected', async () => ({
        factory: () => ({
          hooks: { onBooted: unselectedBooted, onPreboot: unselectedPreload },
          name: 'unselected',
        }),
      })),
      candidate('disabled', async () => ({ factory: disabledFactory }), { enabled: false }),
    ])

    await expect(runtime.preload(app)).resolves.toMatchObject({
      activated: ['enabled', 'unselected'],
      failures: [],
    })
    expect(enabledPreload).toHaveBeenCalledExactlyOnceWith({ app })
    expect(unselectedPreload).toHaveBeenCalledExactlyOnceWith({ app })
    expect(enabledBooted).not.toHaveBeenCalled()
    expect(unselectedBooted).not.toHaveBeenCalled()
    expect(disabledFactory).not.toHaveBeenCalled()

    await expect(runtime.loadNormal({ pluginNames: ['enabled'] }).operation).resolves.toMatchObject(
      { activated: ['enabled'], failures: [] },
    )
    expect(enabledBooted).toHaveBeenCalledOnce()
    expect(unselectedBooted).not.toHaveBeenCalled()
  })

  it('reuses the prepared config and keeps preload cleanup across normal reloads', async () => {
    const events: string[] = []
    const factory = vi.fn(() => ({
      hooks: {
        onBooted: () => {
          events.push('booted')
        },
        onPreboot: () => {
          events.push('preload')
          return () => {
            events.push('preload-cleanup')
          }
        },
        onUnload: () => {
          events.push('unload')
        },
      },
      name: 'reader',
    }))
    const runtime = runtimeFor(() => [candidate('reader', async () => ({ factory }))])

    await runtime.preload({} as App)
    await runtime.loadNormal().operation
    await runtime.reloadNormal().operation

    expect(factory).toHaveBeenCalledOnce()
    expect(events).toEqual(['preload', 'booted', 'unload', 'booted'])
  })

  it('always activates required plugins with a remembered selection', async () => {
    const runtime = runtimeFor(() => [
      candidate('core', async () => ({ factory: () => ({ name: 'core' }) }), { canDisable: false }),
      candidate('reader', async () => ({ factory: () => ({ name: 'reader' }) })),
    ])

    await runtime.preload({} as App)
    const report = await runtime.loadNormal({ pluginNames: ['reader'] }).operation

    expect(report.activated).toEqual(['core', 'reader'])
  })

  it('keeps using the startup snapshot when a prepared plugin changes later', async () => {
    const onBooted = vi.fn()
    const runtime = runtimeFor(() => [
      candidate('reader', async () => ({
        factory: () => ({ hooks: { onBooted }, name: 'reader' }),
      })),
    ])

    await runtime.preload({} as App)
    runtime.markRestartRequired('reader')
    const report = await runtime.loadNormal().operation

    expect(report.activated).toEqual(['reader'])
    expect(onBooted).toHaveBeenCalledOnce()
    expect(runtime.restartRequired.has('reader')).toBe(true)
  })

  it('does not prepare dependents after a dependency preload fails', async () => {
    const dependentFactory = vi.fn(() => ({ name: 'dependent' }))
    const runtime = runtimeFor(() => [
      candidate('dependency', async () => {
        throw new Error('broken entry')
      }),
      candidate('dependent', async () => ({ factory: dependentFactory }), {
        require: ['dependency'],
      }),
    ])

    const report = await runtime.preload({} as App)

    expect(report.failures.map(value => value.plugin)).toEqual(['dependency', 'dependent'])
    expect(report.failures.every(value => value.phase === 'preload')).toBe(true)
    expect(dependentFactory).not.toHaveBeenCalled()
  })
})