import { logger } from '@delta-comic/logger'
import { cors as elysiaCors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

import { createPluginCatalogHandler } from '../lib/catalogHandler'
import { createPluginCatalogPublishHandler } from '../lib/catalogPublishHandler'
import { createR2PluginCatalogStore } from '../lib/catalogStore'
import { serverModules } from '../lib/config'
import { createServerWorkerAdapter } from '../lib/serverAdapter'

import { bindRuntime, type AppEnv } from './env'
import { adminModule } from './modules/admin/admin.module'
import { authModule } from './modules/auth/auth.module'
import { pluginsModule } from './modules/plugins/plugins.module'
import { runScheduledPluginScripts } from './modules/plugins/plugins.script'
import { syncModule } from './modules/sync/sync.module'
import { constantTimeTokenEqual } from './shared/http/adminGuard'
import { apiSuccessSchema, errorResponse, ok } from './shared/response'

export { PluginDatabase } from './modules/plugins/plugins.database'

const serverLogger = logger.scoped('server:lifecycle')

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
  .use(
    elysiaCors({
      allowedHeaders: ['content-type', 'authorization'],
      maxAge: 86_400,
      methods: ['DELETE', 'GET', 'PATCH', 'POST', 'OPTIONS'],
      origin: true,
      preflight: true,
    }),
  )
  .use(
    openapi({
      documentation: {
        components: {
          securitySchemes: {
            adminBearerAuth: { scheme: 'bearer', type: 'http' },
            bearerAuth: { scheme: 'bearer', type: 'http' },
          },
        },
        info: { title: 'Delta Comic Server API', version: '1.0.0' },
        tags: [
          { description: 'Health check and service metadata', name: 'Health' },
          { description: 'Runtime module metadata for admin panels', name: 'Modules' },
          { description: 'Protected server administration and operational metrics', name: 'Admin' },
          { description: 'Server plugin lifecycle and control plane', name: 'Plugins' },
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
  .get('/health/live', () => ok({ service: 'delta-comic-server', status: 'ok' as const }), {
    detail: { summary: 'Worker liveness check', tags: ['Health'] },
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
  .use(adminModule)
  .use(pluginsModule)
  .use(authModule)
  .use(syncModule)

export type App = typeof app

const compiled = app.compile()

const catalogPath = '/plugins/catalog/index.json'
const publishPath = '/plugins/catalog/releases'

const catalogHandler = (env: AppEnv) => {
  if (!env.PLUGIN_CATALOG) return undefined
  return createPluginCatalogHandler({
    store: createR2PluginCatalogStore(env.PLUGIN_CATALOG),
    pathname: catalogPath,
    authorizeWrite: async request => {
      const expected = env.SERVER_ADMIN_TOKEN
      const provided = request.headers.get('authorization')
      if (!expected || !provided?.startsWith('Bearer ')) return false
      return constantTimeTokenEqual(provided.slice('Bearer '.length), expected)
    },
  })
}

const catalogPublishHandler = (env: AppEnv) => {
  if (!env.PLUGIN_CATALOG) return undefined
  const store = createR2PluginCatalogStore(env.PLUGIN_CATALOG)
  return createPluginCatalogPublishHandler({
    store,
    publishPath,
    authorizeWrite: async request => {
      const expected = env.SERVER_ADMIN_TOKEN
      const provided = request.headers.get('authorization')
      if (!expected || !provided?.startsWith('Bearer ')) return false
      return constantTimeTokenEqual(provided.slice('Bearer '.length), expected)
    },
  })
}

const workerAdapter = createServerWorkerAdapter<AppEnv>({
  fetch(request, env, ctx) {
    serverLogger.debug('request received', {
      method: request.method,
      path: new URL(request.url).pathname,
    })
    bindRuntime(request, { ctx, env })
    const catalog = catalogHandler(env)
    if (catalog && new URL(request.url).pathname === catalogPath) return catalog.fetch(request)
    const publisher = catalogPublishHandler(env)
    if (publisher && new URL(request.url).pathname.startsWith(publishPath)) {
      return publisher.fetch(request)
    }
    return compiled.fetch(request)
  },
  scheduled(controller, env, ctx) {
    serverLogger.info('scheduled plugin run started', { cron: controller.cron })
    ctx.waitUntil(runScheduledPluginScripts(env, ctx, controller.scheduledTime, controller.cron))
  },
})

export default {
  ...compiled,
  fetch: workerAdapter.fetch,
  scheduled: workerAdapter.scheduled,
} satisfies ExportedHandler<AppEnv>

export const workerDiagnostics = workerAdapter.diagnostics