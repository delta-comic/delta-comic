import { serverModules } from '@delta-comic/server-config'
import { openapi } from '@elysiajs/openapi'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

import { bindRuntime, type AppEnv } from './env'
import { authModule } from './modules/auth/auth.module'
import { syncModule } from './modules/sync/sync.module'
import { cors } from './shared/http/cors'
import { apiSuccessSchema, errorResponse, ok } from './shared/response'

const healthResponseSchema = t.Object({
  service: t.Literal('delta-comic-server'),
  status: t.Literal('ok'),
})

const moduleResponseSchema = t.Array(
  t.Object({
    adminRoute: t.String(),
    apiPrefix: t.String(),
    cloudflareBindings: t.Array(t.String()),
    description: t.String(),
    key: t.String(),
    name: t.String(),
    workerEnvVars: t.Array(t.String()),
  }),
)

export const app = new Elysia({ adapter: CloudflareAdapter, prefix: '/api' })
  .use(cors)
  .use(
    openapi({
      documentation: {
        components: { securitySchemes: { bearerAuth: { scheme: 'bearer', type: 'http' } } },
        info: { title: 'Delta Comic Server API', version: '1.0.0' },
        tags: [
          { description: 'Health check and service metadata', name: 'Health' },
          { description: 'Runtime module metadata for admin panels', name: 'Modules' },
          { description: 'First-party account and terminal session APIs', name: 'Auth' },
          { description: 'SQLite data sync APIs', name: 'Sync' },
        ],
      },
      path: '/openapi',
    }),
  )
  .onError(({ code, error }) => errorResponse(error, code))
  .model({
    'Response.Health': apiSuccessSchema(healthResponseSchema),
    'Response.Modules': apiSuccessSchema(moduleResponseSchema),
  })
  .get('/health', () => ok({ service: 'delta-comic-server', status: 'ok' as const }), {
    detail: { summary: 'Health check', tags: ['Health'] },
    response: { 200: 'Response.Health' },
  })
  .get(
    '/modules',
    () =>
      ok(
        serverModules.map(module => ({
          ...module,
          cloudflareBindings: [...module.cloudflareBindings],
          workerEnvVars: [...module.workerEnvVars],
        })),
      ),
    {
      detail: { summary: 'List server modules', tags: ['Modules'] },
      response: { 200: 'Response.Modules' },
    },
  )
  .use(authModule)
  .use(syncModule)

export type App = typeof app

const compiled = app.compile()

export default {
  ...compiled,
  fetch(request: Request, env: AppEnv, ctx: ExecutionContext) {
    bindRuntime(request, { ctx, env })
    return compiled.fetch(request)
  },
} satisfies ExportedHandler<AppEnv>