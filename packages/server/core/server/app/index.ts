import { DiagnosticRecorder, withDiagnostic } from '@delta-comic/both'
import { logger } from '@delta-comic/shared-core-logger'
import { cors as elysiaCors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

import { handlePluginArtifactUpload } from '../lib/catalogArtifactHandler'
import { createR2PluginArtifactStore } from '../lib/catalogArtifacts'
import { handlePluginCatalogRequest } from '../lib/catalogHandler'
import { handlePluginPublishRequest } from '../lib/catalogPublishHandler'
import { createR2PluginCatalogStore } from '../lib/catalogStore'
import { serverModules } from '../lib/config'

import { bindRuntime, type AppEnv } from './env'
import { adminModule } from './modules/admin/admin.module'
import { authModule } from './modules/auth/auth.module'
import { runScheduledFlows } from './modules/plugins/plugins.flow.service'
import { pluginsModule } from './modules/plugins/plugins.module'
import { syncModule } from './modules/sync/sync.module'
import { constantTimeTokenEqual } from './shared/http/adminGuard'
import { apiSuccessSchema, errorResponse, ok } from './shared/response'

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
      methods: ['DELETE', 'GET', 'PATCH', 'POST', 'PUT', 'OPTIONS'],
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
const yankPath = '/plugins/catalog/releases/yank'
const artifactPath = '/plugins/catalog/artifacts'
const diagnosticPath = '/api/admin/diagnostics'
export const workerDiagnostics = new DiagnosticRecorder({ capacity: 1000, source: 'server-worker' })

const isAdminRequest = async (request: Request, env: AppEnv) => {
  const expected = env.SERVER_ADMIN_TOKEN
  const provided = request.headers.get('authorization')
  if (!expected || !provided?.startsWith('Bearer ')) return false
  return await constantTimeTokenEqual(provided.slice('Bearer '.length), expected)
}

const route = (request: Request, env: AppEnv) => {
  const pathname = new URL(request.url).pathname
  const authorize = (request: Request) => isAdminRequest(request, env)
  if (env.PLUGIN_CATALOG) {
    const store = createR2PluginCatalogStore(env.PLUGIN_CATALOG)
    if (pathname === catalogPath) return handlePluginCatalogRequest(request, store, authorize)
    if (pathname === publishPath || pathname === yankPath) {
      return handlePluginPublishRequest(request, store, authorize, pathname === yankPath)
    }
  }
  if (env.PLUGIN_ARTIFACTS && env.PLUGIN_PUBLIC_BASE_URL && pathname === artifactPath) {
    const store = createR2PluginArtifactStore(env.PLUGIN_ARTIFACTS, env.PLUGIN_PUBLIC_BASE_URL)
    return handlePluginArtifactUpload(request, store, authorize)
  }
  if (pathname === diagnosticPath) return diagnosticResponse(request, env)
  return compiled.fetch(request)
}

const diagnosticResponse = async (request: Request, env: AppEnv) => {
  if (!(await isAdminRequest(request, env))) return new Response(null, { status: 401 })
  if (request.method !== 'GET')
    return new Response(null, { status: 405, headers: { allow: 'GET' } })
  return Response.json({ ok: true, data: workerDiagnostics.snapshot() })
}

export default {
  ...compiled,
  fetch(request: Request, env: AppEnv, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname
    serverLogger.debug('request received', { method: request.method, path })
    bindRuntime(request, { ctx, env })
    return withDiagnostic(workerDiagnostics, 'server worker fetch', () => route(request, env), {
      method: request.method,
      path,
    })
  },
  scheduled(controller, env, ctx) {
    serverLogger.info('scheduled plugin run started', { cron: controller.cron })
    ctx.waitUntil(runScheduledFlows(env.DB, controller.scheduledTime))
  },
} satisfies ExportedHandler<AppEnv>