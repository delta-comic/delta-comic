import Elysia, { t } from 'elysia'

import { apiSuccessSchema } from '@/shared/response'

export const adminRequiredSecretsSchema = t.Object({
  AUTH_PEPPER: t.Boolean(),
  SERVER_ADMIN_TOKEN: t.Boolean(),
  TOKEN_PEPPER: t.Boolean(),
})

export const adminDeploymentSchema = t.Object({
  available: t.Boolean(),
  id: t.String(),
  tag: t.String(),
  timestamp: t.String(),
})

export const adminReadinessSchema = t.Object({
  checkedAt: t.Number(),
  database: t.Object({ status: t.UnionEnum(['healthy', 'unhealthy']) }),
  issues: t.Array(t.String()),
  ready: t.Boolean(),
  requiredSecrets: adminRequiredSecretsSchema,
  status: t.UnionEnum(['ready', 'degraded', 'unhealthy']),
})

export const adminMetricKeySchema = t.UnionEnum([
  'authUsers',
  'authTerminals',
  'activeAuthSessions',
  'syncEntities',
  'syncChanges',
  'pluginRegistry',
  'pluginInstallations',
  'pluginJobs',
  'pluginAudit',
])

export const adminMetricIssueSchema = t.UnionEnum(['table_missing', 'query_failed'])

export const adminMetricSchema = t.Object({
  issue: t.Optional(adminMetricIssueSchema),
  key: adminMetricKeySchema,
  label: t.String(),
  source: t.Object({ filter: t.Optional(t.String()), table: t.String() }),
  status: t.UnionEnum(['ok', 'degraded']),
  unit: t.Literal('count'),
  value: t.Number({ minimum: 0 }),
})

export const adminPluginAuditSchema = t.Object({
  action: t.String(),
  actorId: t.Optional(t.String()),
  createdAt: t.Number(),
  detail: t.Optional(t.Any()),
  id: t.String(),
  jobId: t.Optional(t.String()),
  outcome: t.String(),
  pluginId: t.String(),
})

export const adminRecentActivitySchema = t.Object({
  available: t.Boolean(),
  issue: t.Optional(adminMetricIssueSchema),
  items: t.Array(adminPluginAuditSchema),
})

const moduleRuntimeSchema = t.Object({
  available: t.Boolean(),
  bindings: t.Record(t.String(), t.Boolean()),
  environment: t.Record(t.String(), t.Boolean()),
})

const runtimeModuleSchema = t.Object({
  adminRoute: t.String(),
  apiPrefix: t.String(),
  cloudflareBindings: t.Array(t.String()),
  description: t.String(),
  key: t.String(),
  name: t.String(),
  runtime: moduleRuntimeSchema,
  workerEnvVars: t.Array(t.String()),
})

export const adminCapabilitiesSchema = t.Object({
  features: t.Object({
    adminAuthentication: t.Literal(true),
    databaseMetrics: t.Literal(true),
    databaseReadiness: t.Literal(true),
    pluginAudit: t.Literal(true),
    versionMetadata: t.Boolean(),
  }),
  modules: t.Array(runtimeModuleSchema),
  observedAt: t.Number(),
  server: t.Object({
    adminPath: t.String(),
    bindings: t.Object({ CF_VERSION_METADATA: t.Boolean(), DB: t.Boolean() }),
    configuration: t.Object({
      accessTokenTtlSeconds: t.Number(),
      refreshTokenTtlSeconds: t.Number(),
      syncMaxPullChanges: t.Number(),
      syncMaxPushOps: t.Number(),
    }),
    requiredSecrets: adminRequiredSecretsSchema,
    service: t.Literal('delta-comic-server'),
  }),
})

export const adminOverviewSchema = t.Object({
  deployment: adminDeploymentSchema,
  health: adminReadinessSchema,
  metrics: t.Array(adminMetricSchema),
  observedAt: t.Number(),
  recentActivity: adminRecentActivitySchema,
})

export type AdminCapabilities = typeof adminCapabilitiesSchema.static
export type AdminDeployment = typeof adminDeploymentSchema.static
export type AdminMetric = typeof adminMetricSchema.static
export type AdminMetricIssue = typeof adminMetricIssueSchema.static
export type AdminOverview = typeof adminOverviewSchema.static
export type AdminPluginAudit = typeof adminPluginAuditSchema.static
export type AdminReadiness = typeof adminReadinessSchema.static
export type AdminRecentActivity = typeof adminRecentActivitySchema.static
export type AdminRequiredSecrets = typeof adminRequiredSecretsSchema.static

export const adminModels = new Elysia({ name: 'dc-admin-models' }).model({
  'Admin.Capabilities': adminCapabilitiesSchema,
  'Admin.Overview': adminOverviewSchema,
  'Admin.Readiness': adminReadinessSchema,
  'Response.AdminCapabilities': apiSuccessSchema(adminCapabilitiesSchema),
  'Response.AdminOverview': apiSuccessSchema(adminOverviewSchema),
  'Response.AdminReadiness': apiSuccessSchema(adminReadinessSchema),
})