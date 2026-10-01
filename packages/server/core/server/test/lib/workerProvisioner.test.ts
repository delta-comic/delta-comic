import { describe, expect, it } from 'vitest'

import {
  CloudflarePluginWorkerProvisioner,
  PluginWorkerRuntimeRegistry,
  UnavailablePluginWorkerProvisioner,
} from '../../lib/index'

describe('plugin worker provisioning', () => {
  it('provisions an installation worker with isolated identity bindings', async () => {
    let received: WorkerLoaderWorkerCode | undefined
    const provisioner = new CloudflarePluginWorkerProvisioner({
      load(code) {
        received = code
        return { getEntrypoint: () => ({ fetch: () => new Response('ok') }) }
      },
    })
    const registry = new PluginWorkerRuntimeRegistry(provisioner)
    await registry.provision({
      code: { compatibilityDate: '2026-07-02', mainModule: 'index.mjs', modules: {} },
      installationId: 'installation-1',
      pluginId: 'demo.plugin',
    })

    expect(received?.env).toMatchObject({
      INSTALLATION_ID: 'installation-1',
      PLUGIN_ID: 'demo.plugin',
    })
    await expect(
      registry.dispatch('installation-1', new Request('https://example.test')),
    ).resolves.toHaveProperty('status', 200)
    expect(registry.list()).toEqual(['installation-1'])
    registry.remove('installation-1')
    await expect(
      registry.dispatch('installation-1', new Request('https://example.test')),
    ).resolves.toHaveProperty('status', 404)
  })

  it('reports unavailable Workers for Platforms provisioning explicitly', async () => {
    await expect(
      new UnavailablePluginWorkerProvisioner().provision({
        code: { compatibilityDate: '2026-07-02', mainModule: 'index.mjs', modules: {} },
        installationId: 'installation-1',
        pluginId: 'demo.plugin',
      }),
    ).rejects.toThrow('Workers for Platforms runtime provisioning is unavailable')
  })
})