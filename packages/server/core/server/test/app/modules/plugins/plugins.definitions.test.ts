import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StaticPluginExecutor } from '../../../../app/modules/plugins/plugins.executor'
import {
  createStaticServerPluginRegistry,
  staticServerPluginRegistry,
} from '../../../../app/modules/plugins/plugins.registry'

describe('bundled server plugin definitions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
  })

  it('reports database readiness and honors the diagnostics detail switch', async () => {
    const readyHost = { probeDatabase: vi.fn(async () => true), readMetric: vi.fn(async () => 0) }
    const ready = new StaticPluginExecutor(staticServerPluginRegistry.values(), readyHost)

    await expect(ready.health('core.diagnostics', {})).resolves.toEqual({
      details: { databaseReady: true, executor: 'static' },
      message: 'static plugin runtime is ready',
      observedAt: 1_700_000_000_000,
      status: 'healthy',
    })

    const unavailable = new StaticPluginExecutor(staticServerPluginRegistry.values(), {
      ...readyHost,
      probeDatabase: vi.fn(async () => false),
    })
    await expect(
      unavailable.health('core.diagnostics', { includeDetails: false }),
    ).resolves.toEqual({
      message: 'database probe failed',
      observedAt: 1_700_000_000_000,
      status: 'unavailable',
    })
  })

  it('marks sync backlog above its configurable threshold as degraded', async () => {
    const host = { probeDatabase: vi.fn(async () => true), readMetric: vi.fn(async () => 11) }
    const executor = new StaticPluginExecutor(staticServerPluginRegistry.values(), host)

    await expect(executor.health('sync.observer', { warningBacklog: 10 })).resolves.toMatchObject({
      details: { cursorBacklog: 11, warningBacklog: 10 },
      message: 'sync cursor backlog exceeds threshold',
      status: 'degraded',
    })
    host.readMetric.mockResolvedValue(10)
    await expect(executor.health('sync.observer', {})).resolves.toMatchObject({
      details: { cursorBacklog: 10, warningBacklog: 1000 },
      message: 'sync observer is ready',
      status: 'healthy',
    })
  })

  it('rejects duplicate ids while retaining both bundled definitions', () => {
    const definitions = [...staticServerPluginRegistry.values()]
    expect(definitions.map(definition => definition.manifest.id)).toEqual([
      'core.diagnostics',
      'sync.observer',
    ])
    expect(() => createStaticServerPluginRegistry([definitions[0], definitions[0]])).toThrow(
      'duplicate static server plugin: core.diagnostics',
    )
  })
})