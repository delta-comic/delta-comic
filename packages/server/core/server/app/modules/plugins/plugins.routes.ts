import Elysia, { t } from 'elysia'

import { getRuntime } from '@/env'
import { serverContext } from '@/infrastructure/http/serverContext'
import { adminGuard } from '@/shared/http/adminGuard'
import { ok } from '@/shared/response'

import { pluginModels } from './plugins.schemas'
import { createPluginScriptService } from './plugins.script'
import { createPluginService } from './plugins.service'

const actorId = 'server-admin'

export const pluginRoutes = new Elysia({
  name: 'dc-server-plugin-routes',
  prefix: '/admin/plugins',
})
  .use(pluginModels)
  .use(serverContext)
  .use(adminGuard)
  .resolve(({ db, request }) => {
    const { ctx, env } = getRuntime(request)
    return {
      pluginScriptService: createPluginScriptService(env, ctx),
      pluginService: createPluginService(db),
    }
  })
  .get('/', async ({ pluginService }) => ok(await pluginService.snapshot()), {
    detail: { summary: 'List discovered and managed server plugins', tags: ['Plugins'] },
    response: { 200: 'Response.PluginSnapshot' },
  })
  .get('/snapshot', async ({ pluginService }) => ok(await pluginService.snapshot()), {
    detail: { summary: 'Read the server plugin control-plane snapshot', tags: ['Plugins'] },
    response: { 200: 'Response.PluginSnapshot' },
  })
  .get(
    '/jobs/:jobId',
    async ({ params, pluginService }) => ok(await pluginService.findJob(params.jobId)),
    {
      detail: { summary: 'Read a server plugin operation job', tags: ['Plugins'] },
      params: 'Plugin.JobParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .get(
    '/:pluginId/script',
    async ({ params, pluginScriptService }) => ok(await pluginScriptService.find(params.pluginId)),
    {
      detail: { summary: 'Read isolated code configured for a server plugin', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: t.Any() },
    },
  )
  .put(
    '/:pluginId/script',
    async ({ body, params, pluginScriptService }) =>
      ok(await pluginScriptService.save(params.pluginId, body)),
    {
      body: 'Plugin.ScriptRequest',
      detail: { summary: 'Configure isolated code and its hourly schedule', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: t.Any() },
    },
  )
  .get(
    '/:pluginId/script/runs',
    async ({ params, pluginScriptService }) =>
      ok(await pluginScriptService.listRuns(params.pluginId)),
    {
      detail: { summary: 'List recent isolated plugin code runs', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: t.Any() },
    },
  )
  .post(
    '/:pluginId/script/run',
    async ({ body, params, pluginScriptService }) =>
      ok(await pluginScriptService.run(params.pluginId, body.input, 'manual')),
    {
      body: 'Plugin.ScriptRunRequest',
      detail: {
        summary: 'Run server plugin code in an isolated Dynamic Worker',
        tags: ['Plugins'],
      },
      params: 'Plugin.IdParams',
      response: { 200: t.Any() },
    },
  )
  .post(
    '/:pluginId/register',
    async ({ params, pluginService }) => ok(await pluginService.register(params.pluginId, actorId)),
    {
      detail: { summary: 'Register a discovered static server plugin', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .post(
    '/:pluginId/install',
    async ({ params, pluginService }) => ok(await pluginService.install(params.pluginId, actorId)),
    {
      detail: { summary: 'Install a server plugin and its dependencies', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .post(
    '/:pluginId/enable',
    async ({ params, pluginService }) => ok(await pluginService.enable(params.pluginId, actorId)),
    {
      detail: { summary: 'Enable a server plugin and its dependencies', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .post(
    '/:pluginId/disable',
    async ({ params, pluginService }) => ok(await pluginService.disable(params.pluginId, actorId)),
    {
      detail: { summary: 'Disable a server plugin', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .post(
    '/:pluginId/update',
    async ({ params, pluginService }) => ok(await pluginService.update(params.pluginId, actorId)),
    {
      detail: { summary: 'Update a server plugin to the bundled version', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .post(
    '/:pluginId/health',
    async ({ params, pluginService }) => ok(await pluginService.health(params.pluginId, actorId)),
    {
      detail: { summary: 'Run and persist a server plugin health check', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .patch(
    '/:pluginId/config',
    async ({ body, params, pluginService }) =>
      ok(await pluginService.configure(params.pluginId, body.config, actorId)),
    {
      body: 'Plugin.ConfigRequest',
      detail: { summary: 'Validate and update server plugin configuration', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )
  .delete(
    '/:pluginId',
    async ({ params, pluginService }) =>
      ok(await pluginService.uninstall(params.pluginId, actorId)),
    {
      detail: { summary: 'Disable, uninstall, and unregister a server plugin', tags: ['Plugins'] },
      params: 'Plugin.IdParams',
      response: { 200: 'Response.PluginJob' },
    },
  )