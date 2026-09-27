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

const runtimeFor = (list: () => readonly PluginCandidate[]) => {
  const remove = vi.fn()
  const runtime = new PluginRuntime({
    capabilities: () =>
      createDefaultCapabilities({
        config: { register: vi.fn(), unregister: vi.fn() },
        contributions: new ContributionHub(),
        i18n: { register: vi.fn(), remove: vi.fn() },
      }),
    environment: () => ({ platform: 'web' }),
    provider: { id: 'test', list: async () => list() } satisfies PluginCandidateProvider,
    remove,
  })
  return Object.assign(runtime, { remove })
}

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

  it('reports invalid dependency graphs without rejecting startup', async () => {
    const independentFactory = vi.fn(() => ({ name: 'independent' }))
    const missingFactory = vi.fn(() => ({ name: 'missing-dependent' }))
    const cyclicFactory = vi.fn(() => ({ name: 'cyclic-a' }))
    const runtime = runtimeFor(() => [
      candidate('independent', async () => ({ factory: independentFactory })),
      candidate('missing-dependent', async () => ({ factory: missingFactory }), {
        require: ['absent'],
      }),
      candidate('cyclic-a', async () => ({ factory: cyclicFactory }), { require: ['cyclic-b'] }),
      candidate('cyclic-b', async () => ({ factory: cyclicFactory }), { require: ['cyclic-a'] }),
    ])

    const report = await runtime.preload({} as App)

    expect(report.activated).toEqual(['independent'])
    expect(report.failures.map(value => value.plugin)).toEqual([
      'missing-dependent',
      'cyclic-a',
      'cyclic-b',
    ])
    expect(report.failures.map(value => String(value.error))).toEqual([
      'Error: missing dependency: absent',
      'Error: dependency cycle: cyclic-a -> cyclic-b -> cyclic-a',
      'Error: dependency cycle: cyclic-a -> cyclic-b -> cyclic-a',
    ])
    expect(independentFactory).toHaveBeenCalledOnce()
    expect(missingFactory).not.toHaveBeenCalled()
    expect(cyclicFactory).not.toHaveBeenCalled()
  })

  it('prepares and activates a plugin enabled after the normal boot', async () => {
    const app = {} as App
    const onPreboot = vi.fn()
    const onBooted = vi.fn()
    let laterEnabled = false
    const runtime = runtimeFor(() => [
      candidate('core', async () => ({ factory: () => ({ name: 'core' }) }), { canDisable: false }),
      candidate(
        'later',
        async () => ({ factory: () => ({ hooks: { onBooted, onPreboot }, name: 'later' }) }),
        { enabled: laterEnabled },
      ),
    ])

    await runtime.preload(app)
    await runtime.loadNormal().operation
    laterEnabled = true
    await runtime.refreshCandidates()

    await runtime.enablePlugin('later')

    expect(onPreboot).toHaveBeenCalledExactlyOnceWith({ app })
    expect(onBooted).toHaveBeenCalledOnce()
    expect(runtime.activeNormalPluginNames).toContain('later')
  })

  it('only prepares a plugin enabled before the normal boot', async () => {
    const onPreboot = vi.fn()
    const onBooted = vi.fn()
    let laterEnabled = false
    const runtime = runtimeFor(() => [
      candidate(
        'later',
        async () => ({ factory: () => ({ hooks: { onBooted, onPreboot }, name: 'later' }) }),
        { enabled: laterEnabled },
      ),
    ])

    await runtime.preload({} as App)
    laterEnabled = true
    await runtime.refreshCandidates()

    await runtime.enablePlugin('later')

    expect(onPreboot).toHaveBeenCalledOnce()
    expect(onBooted).not.toHaveBeenCalled()
    expect(runtime.activeNormalPluginNames).not.toContain('later')
  })

  it('deactivates and unloads a plugin on dynamic disable', async () => {
    const dispose = vi.fn()
    const onUnload = vi.fn()
    let laterEnabled = true
    const runtime = runtimeFor(() => [
      candidate('core', async () => ({ factory: () => ({ name: 'core' }) }), { canDisable: false }),
      candidate(
        'later',
        async () => ({ dispose, factory: () => ({ hooks: { onUnload }, name: 'later' }) }),
        { enabled: laterEnabled },
      ),
    ])

    await runtime.preload({} as App)
    await runtime.loadNormal().operation
    laterEnabled = false
    await runtime.refreshCandidates()

    await runtime.disablePlugin('later')

    expect(runtime.activeNormalPluginNames).not.toContain('later')
    expect(onUnload).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('refuses to disable a plugin that another prepared plugin requires', async () => {
    const runtime = runtimeFor(() => [
      candidate('dependency', async () => ({ factory: () => ({ name: 'dependency' }) })),
      candidate('dependent', async () => ({ factory: () => ({ name: 'dependent' }) }), {
        require: ['dependency'],
      }),
    ])

    await runtime.preload({} as App)

    await expect(runtime.disablePlugin('dependency')).rejects.toThrow('required by dependent')
  })

  it('refuses to enable a plugin whose required dependency is disabled', async () => {
    let laterEnabled = false
    const runtime = runtimeFor(() => [
      candidate('dependency', async () => ({ factory: () => ({ name: 'dependency' }) }), {
        enabled: false,
      }),
      candidate('later', async () => ({ factory: () => ({ name: 'later' }) }), {
        enabled: laterEnabled,
        require: ['dependency'],
      }),
    ])

    await runtime.preload({} as App)
    laterEnabled = true
    await runtime.refreshCandidates()

    await expect(runtime.enablePlugin('later')).rejects.toThrow(
      'plugin "dependency" is not enabled',
    )
  })

  it('uninstalls a plugin when its entry cannot be loaded for the uninstall hook', async () => {
    const runtime = runtimeFor(() => [
      candidate('broken', async () => {
        throw new TypeError('plugin entry has no default factory: broken')
      }),
    ])

    await runtime.preload({} as App)
    await runtime.uninstall('broken')

    expect(runtime.remove).toHaveBeenCalledExactlyOnceWith('broken')
  })

  it('prepares enabled dependencies before the dependent plugin', async () => {
    const events: string[] = []
    let laterEnabled = false
    let dependencyEnabled = false
    const runtime = runtimeFor(() => [
      candidate(
        'dependency',
        async () => ({
          factory: () => ({
            hooks: {
              onPreboot: () => {
                events.push('dependency')
              },
            },
            name: 'dependency',
          }),
        }),
        { enabled: dependencyEnabled },
      ),
      candidate(
        'later',
        async () => ({
          factory: () => ({
            hooks: {
              onPreboot: () => {
                events.push('later')
              },
            },
            name: 'later',
          }),
        }),
        { enabled: laterEnabled, require: ['dependency'] },
      ),
    ])

    await runtime.preload({} as App)
    laterEnabled = true
    dependencyEnabled = true
    await runtime.refreshCandidates()

    await runtime.enablePlugin('later')

    expect(events).toEqual(['dependency', 'later'])
  })

  it('reloads an updated plugin and its prepared dependents from the current files', async () => {
    const app = {} as App
    let dependencyGeneration = 0
    let dependentGeneration = 0
    const dependencyUnloads: number[] = []
    const dependentUnloads: number[] = []
    const runtime = runtimeFor(() => [
      candidate('dependency', async () => ({
        factory: () => ({
          hooks: {
            onPreboot: () => {
              dependencyGeneration += 1
            },
            onUnload: () => {
              dependencyUnloads.push(dependencyGeneration)
            },
          },
          name: 'dependency',
        }),
      })),
      candidate(
        'dependent',
        async () => ({
          factory: () => ({
            hooks: {
              onPreboot: () => {
                dependentGeneration += 1
              },
              onUnload: () => {
                dependentUnloads.push(dependentGeneration)
              },
            },
            name: 'dependent',
          }),
        }),
        { require: ['dependency'] },
      ),
    ])

    await runtime.preload(app)
    await runtime.loadNormal().operation
    expect(dependencyGeneration).toBe(1)
    expect(dependentGeneration).toBe(1)

    await runtime.reloadPlugin('dependency')

    expect(dependencyGeneration).toBe(2)
    expect(dependentGeneration).toBe(2)
    expect(runtime.activeNormalPluginNames).toEqual(
      expect.arrayContaining(['dependency', 'dependent']),
    )
    expect(dependencyUnloads).toEqual([1])
    expect(dependentUnloads).toEqual([1])
  })

  it('keeps an updated plugin unloaded while it stays disabled', async () => {
    let dependencyEnabled = false
    const factory = vi.fn(() => ({ name: 'dependency' }))
    const runtime = runtimeFor(() => [
      candidate('dependency', async () => ({ factory }), { enabled: dependencyEnabled }),
    ])

    await runtime.preload({} as App)
    await runtime.loadNormal().operation
    await runtime.reloadPlugin('dependency')

    expect(factory).not.toHaveBeenCalled()
    expect(runtime.activeNormalPluginNames).not.toContain('dependency')
  })

  it('rolls back preparation when dynamic activation fails', async () => {
    const cleanup = vi.fn()
    const dispose = vi.fn()
    let laterEnabled = false
    const runtime = runtimeFor(() => [
      candidate('core', async () => ({ factory: () => ({ name: 'core' }) }), { canDisable: false }),
      candidate(
        'later',
        async () => ({
          dispose,
          factory: () => ({
            hooks: {
              onBooted: () => {
                throw new Error('broken boot')
              },
              onPreboot: () => cleanup,
            },
            name: 'later',
          }),
        }),
        { enabled: laterEnabled },
      ),
    ])

    await runtime.preload({} as App)
    await runtime.loadNormal().operation
    laterEnabled = true
    await runtime.refreshCandidates()

    await expect(runtime.enablePlugin('later')).rejects.toThrow('broken boot')

    expect(runtime.activeNormalPluginNames).not.toContain('later')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })
})