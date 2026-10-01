import { describe, expect, it } from 'vitest'

import {
  CloudflarePluginWorkerProvisioner,
  CloudflareDispatchWorkerProvisioner,
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

  it('resolves an installation through the Workers for Platforms dispatcher with limits', async () => {
    let received: unknown
    const provisioner = new CloudflareDispatchWorkerProvisioner({
      get(name, bindings, options) {
        received = { bindings, name, options }
        return { fetch: () => new Response('ok') }
      },
    })
    const worker = await provisioner.provision({
      code: { compatibilityDate: '2026-07-02', mainModule: 'index.mjs', modules: {} },
      installationId: 'installation-1',
      pluginId: 'demo.plugin',
    })
    expect(received).toMatchObject({
      bindings: { INSTALLATION_ID: 'installation-1', PLUGIN_ID: 'demo.plugin' },
      name: 'installation-1',
      options: { limits: { cpuMs: 50, subRequests: 50 } },
    })
    expect(await worker.fetch(new Request('https://example.test'))).toHaveProperty('status', 200)
  })
})