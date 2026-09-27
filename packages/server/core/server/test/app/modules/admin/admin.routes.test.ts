import { describe, expect, it, vi } from 'vitest'

import { adminRoutes } from '../../../../app/modules/admin/admin.routes'

interface RouteRecord {
  handler: (context: Record<string, unknown>) => unknown
  path: string
}

const findRoute = (path: string): RouteRecord => {
  const routes = (adminRoutes as unknown as { routes: RouteRecord[] }).routes
  const route = routes.find(candidate => candidate.path.endsWith(path))
  if (!route) throw new Error(`admin route not found: ${path}`)
  return route
}

describe('admin route handlers', () => {
  it('wraps capabilities and overview service results', async () => {
    const adminMetrics = {
      capabilities: vi.fn(() => ({ modules: 7 })),
      overview: vi.fn(async () => ({ metrics: 9 })),
    }

    expect(findRoute('/capabilities').handler({ adminMetrics })).toEqual({
      data: { modules: 7 },
      ok: true,
    })
    await expect(findRoute('/overview').handler({ adminMetrics })).resolves.toEqual({
      data: { metrics: 9 },
      ok: true,
    })
  })

  it('returns normal success for ready state and an explicit 503 status otherwise', async () => {
    const readiness = vi.fn()
    const adminMetrics = { readiness }
    readiness.mockResolvedValueOnce({ ready: true, status: 'healthy' })
    await expect(findRoute('/health/ready').handler({ adminMetrics })).resolves.toEqual({
      data: { ready: true, status: 'healthy' },
      ok: true,
    })

    readiness.mockResolvedValueOnce({ ready: false, status: 'unhealthy' })
    await expect(findRoute('/health/ready').handler({ adminMetrics })).resolves.toMatchObject({
      code: 503,
      response: { data: { ready: false, status: 'unhealthy' }, ok: true },
    })
  })
})