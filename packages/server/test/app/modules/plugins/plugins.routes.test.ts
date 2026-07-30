import { describe, expect, it, vi } from 'vitest'

import { pluginRoutes } from '../../../../app/modules/plugins/plugins.routes'

interface RouteRecord {
  handler: (context: Record<string, unknown>) => unknown
  method: string
  path: string
}

const findRoute = (method: string, pathSuffix: string): RouteRecord => {
  const routes = (pluginRoutes as unknown as { routes: RouteRecord[] }).routes
  const route = routes.find(
    candidate =>
      String(candidate.method).toUpperCase() === method && candidate.path.endsWith(pathSuffix),
  )
  if (!route) throw new Error(`plugin route not found: ${method} ${pathSuffix}`)
  return route
}

describe('server plugin route handlers', () => {
  it('serves both list aliases and job lookup through the plugin service', async () => {
    const pluginService = {
      findJob: vi.fn(async jobId => ({ id: jobId })),
      snapshot: vi.fn(async () => ({ plugins: ['core'] })),
    }

    await expect(findRoute('GET', '/admin/plugins/').handler({ pluginService })).resolves.toEqual({
      data: { plugins: ['core'] },
      ok: true,
    })
    await expect(findRoute('GET', '/snapshot').handler({ pluginService })).resolves.toEqual({
      data: { plugins: ['core'] },
      ok: true,
    })
    await expect(
      findRoute('GET', '/jobs/:jobId').handler({ params: { jobId: 'job-1' }, pluginService }),
    ).resolves.toEqual({ data: { id: 'job-1' }, ok: true })
    expect(pluginService.snapshot).toHaveBeenCalledTimes(2)
    expect(pluginService.findJob).toHaveBeenCalledExactlyOnceWith('job-1')
  })

  it('delegates script read, save, history, and manual execution with exact inputs', async () => {
    const pluginScriptService = {
      find: vi.fn(async pluginId => ({ pluginId, source: 'code' })),
      listRuns: vi.fn(async pluginId => [{ pluginId, run: 1 }]),
      run: vi.fn(async (pluginId, input, trigger) => ({ input, pluginId, trigger })),
      save: vi.fn(async (pluginId, body) => ({ body, pluginId })),
    }
    const params = { pluginId: 'feature.sync' }

    await expect(
      findRoute('GET', '/:pluginId/script').handler({ params, pluginScriptService }),
    ).resolves.toMatchObject({ data: { pluginId: 'feature.sync' }, ok: true })
    await expect(
      findRoute('PUT', '/:pluginId/script').handler({
        body: { code: 'export default {}' },
        params,
        pluginScriptService,
      }),
    ).resolves.toMatchObject({ data: { pluginId: 'feature.sync' }, ok: true })
    await expect(
      findRoute('GET', '/:pluginId/script/runs').handler({ params, pluginScriptService }),
    ).resolves.toEqual({ data: [{ pluginId: 'feature.sync', run: 1 }], ok: true })
    await expect(
      findRoute('POST', '/:pluginId/script/run').handler({
        body: { input: { threshold: 2 } },
        params,
        pluginScriptService,
      }),
    ).resolves.toMatchObject({
      data: { input: { threshold: 2 }, pluginId: 'feature.sync', trigger: 'manual' },
      ok: true,
    })
    expect(pluginScriptService.save).toHaveBeenCalledExactlyOnceWith('feature.sync', {
      code: 'export default {}',
    })
    expect(pluginScriptService.run).toHaveBeenCalledExactlyOnceWith(
      'feature.sync',
      { threshold: 2 },
      'manual',
    )
  })

  it('uses the fixed admin actor for every plugin state mutation', async () => {
    const pluginService = Object.fromEntries(
      ['register', 'install', 'enable', 'disable', 'update', 'health', 'uninstall'].map(action => [
        action,
        vi.fn(async (pluginId, actor) => ({ action, actor, pluginId })),
      ]),
    ) as Record<string, ReturnType<typeof vi.fn>>
    pluginService.configure = vi.fn(async (pluginId, config, actor) => ({
      action: 'configure',
      actor,
      config,
      pluginId,
    }))
    const params = { pluginId: 'feature.sync' }
    const cases = [
      ['POST', '/:pluginId/register', 'register'],
      ['POST', '/:pluginId/install', 'install'],
      ['POST', '/:pluginId/enable', 'enable'],
      ['POST', '/:pluginId/disable', 'disable'],
      ['POST', '/:pluginId/update', 'update'],
      ['POST', '/:pluginId/health', 'health'],
      ['DELETE', '/:pluginId', 'uninstall'],
    ] as const

    for (const [method, path, action] of cases) {
      await expect(findRoute(method, path).handler({ params, pluginService })).resolves.toEqual({
        data: { action, actor: 'server-admin', pluginId: 'feature.sync' },
        ok: true,
      })
      expect(pluginService[action]).toHaveBeenCalledExactlyOnceWith('feature.sync', 'server-admin')
    }

    await expect(
      findRoute('PATCH', '/:pluginId/config').handler({
        body: { config: { threshold: 9 } },
        params,
        pluginService,
      }),
    ).resolves.toEqual({
      data: {
        action: 'configure',
        actor: 'server-admin',
        config: { threshold: 9 },
        pluginId: 'feature.sync',
      },
      ok: true,
    })
    expect(pluginService.configure).toHaveBeenCalledExactlyOnceWith(
      'feature.sync',
      { threshold: 9 },
      'server-admin',
    )
  })
})