import Elysia, { t } from 'elysia'

import { apiSuccessSchema } from '@/shared/response'

import {
  pluginConfigValueSchema,
  pluginIdPattern,
  serverPluginManifestSchema,
} from './plugins.manifest'

export const pluginActionSchema = t.UnionEnum([
  'configure',
  'disable',
  'enable',
  'health',
  'install',
  'register',
  'uninstall',
  'update',
])

export const pluginHealthSchema = t.Object({
  details: t.Optional(t.Record(t.String(), pluginConfigValueSchema)),
  message: t.String(),
  observedAt: t.Number(),
  status: t.UnionEnum(['degraded', 'healthy', 'unavailable']),
})

export const pluginJobSchema = t.Object({
  action: pluginActionSchema,
  completedAt: t.Optional(t.Number()),
  createdAt: t.Number(),
  errorMessage: t.Optional(t.String()),
  id: t.String(),
  pluginId: t.String(),
  result: t.Optional(t.Record(t.String(), t.Any())),
  startedAt: t.Optional(t.Number()),
  status: t.UnionEnum(['failed', 'queued', 'running', 'succeeded']),
  updatedAt: t.Number(),
})

const pluginAuditSchema = t.Object({
  action: pluginActionSchema,
  actorId: t.String(),
  createdAt: t.Number(),
  detail: t.Optional(t.Record(t.String(), t.Any())),
  id: t.String(),
  jobId: t.String(),
  outcome: t.UnionEnum(['failed', 'succeeded']),
  pluginId: t.String(),
})

const pluginPlanSchema = t.Object({
  cycles: t.Array(t.Array(t.String())),
  levels: t.Array(t.Array(t.String())),
  missing: t.Array(
    t.Object({
      actualVersion: t.Optional(t.String()),
      dependencyId: t.String(),
      pluginId: t.String(),
      reason: t.UnionEnum(['incompatible', 'missing']),
      versionRange: t.Optional(t.String()),
    }),
  ),
})

const pluginSnapshotEntrySchema = t.Object({
  allowedActions: t.Array(pluginActionSchema),
  config: t.Record(t.String(), pluginConfigValueSchema),
  desiredState: t.UnionEnum(['disabled', 'enabled', 'uninstalled']),
  installedVersion: t.Optional(t.String()),
  lastError: t.Optional(t.String()),
  lastHealth: t.Optional(pluginHealthSchema),
  manifest: serverPluginManifestSchema,
  observedState: t.UnionEnum([
    'available',
    'disabled',
    'enabled',
    'failed',
    'installed',
    'registered',
  ]),
  registered: t.Boolean(),
  updateAvailable: t.Boolean(),
})

export const pluginSnapshotSchema = t.Object({
  observedAt: t.Number(),
  plan: pluginPlanSchema,
  plugins: t.Array(pluginSnapshotEntrySchema),
  recentAudit: t.Array(pluginAuditSchema),
  recentJobs: t.Array(pluginJobSchema),
})

export const pluginConfigRequestSchema = t.Object({
  config: t.Record(t.String(), pluginConfigValueSchema),
})

export const pluginIdParamsSchema = t.Object({
  pluginId: t.String({ maxLength: 160, minLength: 1, pattern: pluginIdPattern }),
})

export const pluginJobParamsSchema = t.Object({ jobId: t.String({ maxLength: 160, minLength: 1 }) })

export const pluginScriptRequestSchema = t.Object({
  enabled: t.Boolean(),
  intervalHours: t.Number({ maximum: 168, minimum: 1 }),
  nextRunAt: t.Optional(t.Number({ minimum: 0 })),
  source: t.String({ maxLength: 100_000, minLength: 1 }),
})

export const pluginScriptRunRequestSchema = t.Object({ input: t.Optional(t.Any()) })

export const pluginModels = new Elysia({ name: 'dc-server-plugin-models' }).model({
  'Plugin.ConfigRequest': pluginConfigRequestSchema,
  'Plugin.IdParams': pluginIdParamsSchema,
  'Plugin.JobParams': pluginJobParamsSchema,
  'Plugin.Job': pluginJobSchema,
  'Plugin.ScriptRequest': pluginScriptRequestSchema,
  'Plugin.ScriptRunRequest': pluginScriptRunRequestSchema,
  'Plugin.Snapshot': pluginSnapshotSchema,
  'Response.PluginJob': apiSuccessSchema(pluginJobSchema),
  // Runtime definitions intentionally expose readonly manifest arrays to plugin authors.
  // Keep the named snapshot model detailed, while allowing the serialized readonly form.
  'Response.PluginSnapshot': apiSuccessSchema(t.Any()),
})