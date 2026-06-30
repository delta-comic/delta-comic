import Elysia, { t } from 'elysia'

import { authModule } from '../modules/auth/auth.module'
import { syncModule } from '../modules/sync/sync.module'
import { apiSuccessSchema, ok } from '../shared/response'

const healthResponseSchema = t.Object({
  service: t.Literal('delta-comic-server'),
  status: t.Literal('ok'),
})

export const v1 = new Elysia({ prefix: '/v1' })
  .model({ 'Response.Health': apiSuccessSchema(healthResponseSchema) })
  .get('/health', () => ok({ service: 'delta-comic-server', status: 'ok' as const }), {
    detail: { summary: 'Health check', tags: ['Health'] },
    response: { 200: 'Response.Health' },
  })
  .use(authModule)
  .use(syncModule)