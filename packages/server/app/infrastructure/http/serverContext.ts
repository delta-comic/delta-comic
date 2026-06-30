import Elysia from 'elysia'

import { getRuntime } from '@/env'
import { createAuthService } from '@/modules/auth/auth.service'
import { createSyncService } from '@/modules/sync/sync.service'

export const serverContext = new Elysia({ name: 'dc-server-context' })
  .resolve(({ request }) => {
    const runtime = getRuntime(request)
    const db = runtime.env.DB

    return {
      authService: createAuthService(db, {
        accessTtlSeconds: runtime.env.ACCESS_TOKEN_TTL_SECONDS,
        authPepper: runtime.env.AUTH_PEPPER,
        refreshTtlSeconds: runtime.env.REFRESH_TOKEN_TTL_SECONDS,
        tokenPepper: runtime.env.TOKEN_PEPPER,
      }),
      db,
      runtime,
      syncService: createSyncService(db, {
        maxPullChanges: runtime.env.SYNC_MAX_PULL_CHANGES,
        maxPushOps: runtime.env.SYNC_MAX_PUSH_OPS,
      }),
    }
  })
  .as('scoped')