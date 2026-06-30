import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
import { openapi } from '@elysiajs/openapi'

import { bindRuntime, type AppEnv } from './env'
import { cors } from './shared/http/cors'
import { errorResponse } from './shared/response'
import { v1 } from './v1'

export const app = new Elysia({ adapter: CloudflareAdapter, prefix: '/api' })
  .use(cors)
  .use(openapi({
    documentation: {
      components: {
        securitySchemes: {
          bearerAuth: {
            scheme: 'bearer',
            type: 'http',
          },
        },
      },
      info: {
        title: 'Delta Comic Server API',
        version: '1.0.0',
      },
      tags: [
        { description: 'Health check and service metadata', name: 'Health' },
        { description: 'First-party account and terminal session APIs', name: 'Auth' },
        { description: 'SQLite data sync APIs', name: 'Sync' },
      ],
    },
    path: '/openapi',
  }))
  .onError(({ code, error }) => errorResponse(error, code))
  .use(v1)

export type App = typeof app

const compiled = app.compile()

export default {
  fetch(request: Request, env: AppEnv, ctx: ExecutionContext) {
    bindRuntime(request, { ctx, env })
    return compiled.fetch(request)
  },
} satisfies ExportedHandler<AppEnv>