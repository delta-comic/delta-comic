import { describe, expect, it, vi } from 'vitest'

import { syncRoutes } from '../../../../app/modules/sync/sync.routes'

interface RouteRecord {
  handler: (context: Record<string, unknown>) => unknown
  path: string
}

const findRoute = (path: string): RouteRecord => {
  const routes = (syncRoutes as unknown as { routes: RouteRecord[] }).routes
  const route = routes.find(candidate => candidate.path.endsWith(path))
  if (!route) throw new Error(`sync route not found: ${path}`)
  return route
}

describe('sync route handlers', () => {
  it('passes authenticated snapshot, push, and pull payloads to the service', async () => {
    const auth = { terminalUuid: 'terminal-1', userId: 'user-1' }
    const syncService = {
      pull: vi.fn(async (context, body) => ({ body, context, kind: 'pull' })),
      push: vi.fn(async (context, body) => ({ body, context, kind: 'push' })),
      snapshot: vi.fn(async (context, body) => ({ body, context, kind: 'snapshot' })),
    }

    for (const path of ['/snapshot', '/push', '/pull'] as const) {
      const body = { path }
      await expect(findRoute(path).handler({ auth, body, syncService })).resolves.toEqual({
        data: { body, context: auth, kind: path.slice(1) },
        ok: true,
      })
    }
    expect(syncService.snapshot).toHaveBeenCalledExactlyOnceWith(auth, { path: '/snapshot' })
    expect(syncService.push).toHaveBeenCalledExactlyOnceWith(auth, { path: '/push' })
    expect(syncService.pull).toHaveBeenCalledExactlyOnceWith(auth, { path: '/pull' })
  })
})