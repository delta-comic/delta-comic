import Elysia, { status } from 'elysia'

import { getRuntime } from '@/env'
import { adminGuard } from '@/shared/http/adminGuard'
import { ok } from '@/shared/response'

import { adminModels } from './admin.schemas'
import { createAdminMetricsService } from './admin.service'

export const adminRoutes = new Elysia({ name: 'dc-admin-routes', prefix: '/admin' })
  .use(adminModels)
  .use(adminGuard)
  .resolve(({ request }) => ({ adminMetrics: createAdminMetricsService(getRuntime(request).env) }))
  .get('/capabilities', ({ adminMetrics }) => ok(adminMetrics.capabilities()), {
    detail: { summary: 'Describe server capabilities and runtime configuration', tags: ['Admin'] },
    response: { 200: 'Response.AdminCapabilities' },
  })
  .get(
    '/health/ready',
    async ({ adminMetrics }) => {
      const readiness = await adminMetrics.readiness()
      const response = ok(readiness)
      return readiness.ready ? response : status(503, response)
    },
    {
      detail: { summary: 'Probe server readiness and required configuration', tags: ['Admin'] },
      response: { 200: 'Response.AdminReadiness', 503: 'Response.AdminReadiness' },
    },
  )
  .get('/overview', async ({ adminMetrics }) => ok(await adminMetrics.overview()), {
    detail: { summary: 'Read operational counts and recent plugin activity', tags: ['Admin'] },
    response: { 200: 'Response.AdminOverview' },
  })