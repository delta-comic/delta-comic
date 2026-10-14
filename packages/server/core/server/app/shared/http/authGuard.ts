import { bearer } from '@elysiajs/bearer'
import Elysia from 'elysia'

import { serverContext } from '@/infrastructure/http/serverContext'
import { AppError } from '@/shared/errors'

export const authGuard = new Elysia({ name: 'dc-auth-guard' })
  .use(serverContext)
  .use(bearer())
  .guard({ detail: { security: [{ bearerAuth: [] }] } })
  .resolve(async ({ authService, bearer: token }) => {
    if (!token)
      throw new AppError('AUTH_MISSING_TOKEN', 'authorization Bearer token is required', 401)
    return { auth: await authService.authenticateAccessToken(token) }
  })
  .as('scoped')