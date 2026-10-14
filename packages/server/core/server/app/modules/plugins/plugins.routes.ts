import Elysia, { t } from 'elysia'

import { authGuard } from '@/shared/http/authGuard'
import { ok } from '@/shared/response'

import { FlowService } from './plugins.flow.service'

const schedule = t.Optional(
  t.Object({
    flowId: t.String(),
    enabled: t.Boolean(),
    intervalHours: t.Integer({ minimum: 1, maximum: 168 }),
    nextRunAt: t.Optional(t.Integer({ minimum: 0 })),
  }),
)
const config = t.Record(t.String(), t.Unknown())
const params = t.Object({ pluginId: t.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' }) })

export const pluginRoutes = new Elysia({ name: 'dc-server-plugin-routes', prefix: '/plugins' })
  .use(authGuard)
  .resolve(({ db, auth }) => ({ flowService: new FlowService(db, auth.userId) }))
  .get('/', async ({ flowService }) => ok(await flowService.repository.list()))
  .get(
    '/:pluginId',
    async ({ flowService, params }) => ok(await flowService.repository.find(params.pluginId)),
    { params },
  )
  .put(
    '/:pluginId',
    async ({ flowService, params, body }) => ok(await flowService.install(params.pluginId, body)),
    {
      params,
      body: t.Object({
        manifest: t.Unknown(),
        source: t.String({ maxLength: 262144 }),
        config,
        enabled: t.Boolean(),
        schedule,
      }),
    },
  )
  .patch(
    '/:pluginId',
    async ({ flowService, params, body }) =>
      ok(await flowService.configure(params.pluginId, body.config, body.enabled, body.schedule)),
    { params, body: t.Object({ config, enabled: t.Boolean(), schedule }) },
  )
  .delete(
    '/:pluginId',
    async ({ flowService, params }) => {
      await flowService.repository.remove(params.pluginId)
      return ok({ pluginId: params.pluginId })
    },
    { params },
  )
  .get(
    '/:pluginId/runs',
    async ({ flowService, params }) => ok(await flowService.repository.listRuns(params.pluginId)),
    { params },
  )
  .post(
    '/:pluginId/flows/:flowId/run',
    async ({ flowService, params, body, request }) => {
      const result = await flowService.run(
        params.pluginId,
        params.flowId,
        body.input,
        'manual',
        request.signal,
      )
      return result instanceof Response ? result : ok(result)
    },
    {
      params: t.Object({ ...params.properties, flowId: t.String() }),
      body: t.Object({ input: t.Unknown() }),
    },
  )