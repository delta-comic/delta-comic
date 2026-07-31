import { describe, expect, it, vi } from 'vitest'

import { StaticPluginExecutor } from '../../../../app/modules/plugins/plugins.executor'
import { defineServerPlugin } from '../../../../lib/plugin'

const manifest = {
  apiVersion: 1 as const,
  author: 'Delta Comic',
  capabilities: ['health.read'] as const,
  configSchema: {
    properties: {
      threshold: { defaultValue: 2, label: '阈值', minimum: 1, type: 'number' as const },
    },
  },
  dependencies: [],
  description: 'test runtime',
  id: 'test.runtime',
  name: 'Test runtime',
  version: '1.2.0',
}

describe('StaticPluginExecutor', () => {
  it('runs every lifecycle hook with normalized immutable config and host access', async () => {
    const calls: string[] = []
    const seenContexts: unknown[] = []
    const plugin = defineServerPlugin({
      manifest,
      runtime: {
        async health(context) {
          seenContexts.push(context)
          return {
            details: { value: await context.host.readMetric('sync.changeCount') },
            message: 'ok',
            observedAt: 10,
            status: 'healthy',
          }
        },
        async install(context) {
          calls.push('install')
          seenContexts.push(context)
        },
        async start(context) {
          calls.push('start')
          seenContexts.push(context)
        },
        async stop(context) {
          calls.push('stop')
          seenContexts.push(context)
        },
        async uninstall(context) {
          calls.push('uninstall')
          seenContexts.push(context)
        },
        async update(context, previousVersion) {
          calls.push(`update:${previousVersion}`)
          seenContexts.push(context)
        },
      },
    })
    const host = { probeDatabase: vi.fn(async () => true), readMetric: vi.fn(async () => 7) }
    const executor = new StaticPluginExecutor([plugin], host)

    await executor.install(manifest.id, {})
    await executor.update(manifest.id, '1.0.0', { threshold: 4 })
    await executor.start(manifest.id, { threshold: 4 })
    await executor.stop(manifest.id, { threshold: 4 })
    await executor.uninstall(manifest.id, { threshold: 4 })
    await expect(executor.health(manifest.id, { threshold: 4 })).resolves.toMatchObject({
      details: { value: 7 },
      status: 'healthy',
    })

    expect(calls).toEqual(['install', 'update:1.0.0', 'start', 'stop', 'uninstall'])
    expect(seenContexts[0]).toMatchObject({
      config: { threshold: 2 },
      pluginId: manifest.id,
      version: manifest.version,
    })
    expect(Object.isFrozen((seenContexts[0] as { config: object }).config)).toBe(true)
    expect(host.readMetric).toHaveBeenCalledWith('sync.changeCount')
  })

  it('falls back to install during update and supplies default health for empty runtimes', async () => {
    const install = vi.fn(async () => undefined)
    const plugin = defineServerPlugin({ manifest, runtime: { install } })
    const executor = new StaticPluginExecutor([plugin])

    await executor.update(manifest.id, '1.0.0', {})
    const health = await executor.health(manifest.id, {})

    expect(install).toHaveBeenCalledOnce()
    expect(health).toMatchObject({ message: 'static plugin runtime is ready', status: 'healthy' })
    expect(health.observedAt).toBeTypeOf('number')
  })

  it('sorts definitions and rejects duplicates or unknown runtime ids', async () => {
    const alpha = defineServerPlugin({
      manifest: { ...manifest, id: 'alpha.plugin', name: 'Alpha' },
      runtime: {},
    })
    const omega = defineServerPlugin({
      manifest: { ...manifest, id: 'omega.plugin', name: 'Omega' },
      runtime: {},
    })
    const executor = new StaticPluginExecutor([omega, alpha])

    expect(executor.listDefinitions().map(item => item.manifest.id)).toEqual([
      'alpha.plugin',
      'omega.plugin',
    ])
    expect(executor.getDefinition('alpha.plugin')).toEqual(alpha)
    expect(executor.getDefinition('missing')).toBeUndefined()
    await expect(executor.install('missing', {})).rejects.toMatchObject({
      code: 'PLUGIN_DEFINITION_NOT_FOUND',
      status: 404,
    })
    expect(() => new StaticPluginExecutor([alpha, alpha])).toThrow(
      'static plugin executor received duplicate definitions',
    )
  })
})