import { describe, expect, it } from 'vitest'

import { PluginInstallationManager, UnavailablePluginInstallationDatabase } from '../../lib/index'

describe('plugin installation manager', () => {
  it('creates one isolated database per plugin installation and removes it', async () => {
    const created: string[] = []
    const removed: string[] = []
    const manager = new PluginInstallationManager({
      async create(pluginId, installationId) {
        created.push(`${pluginId}:${installationId}`)
        return { databaseId: `${pluginId}-${installationId}` }
      },
      async remove(pluginId, installationId, databaseId) {
        removed.push(`${pluginId}:${installationId}:${databaseId}`)
      },
    })

    const first = await manager.ensure('demo', 'one')
    const second = await manager.ensure('demo', 'one')
    expect(second).toBe(first)
    expect(created).toEqual(['demo:one'])
    await manager.remove('demo', 'one')
    expect(removed).toEqual(['demo:one:demo-one'])
    expect(manager.list()).toHaveLength(0)
  })

  it('reports unavailable provisioning explicitly', async () => {
    await expect(
      new PluginInstallationManager(new UnavailablePluginInstallationDatabase()).ensure(
        'demo',
        'one',
      ),
    ).rejects.toThrow('per-installation D1 provisioning is unavailable')
  })
})