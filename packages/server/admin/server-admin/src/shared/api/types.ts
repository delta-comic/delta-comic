import type { ServerModuleDefinition } from '@delta-comic/server'

export interface AdminModuleRuntime {
  available: boolean
  bindings: Record<string, boolean>
  environment: Record<string, boolean>
}

export type AdminModule = ServerModuleDefinition & { runtime: AdminModuleRuntime }

export interface AdminCapabilities {
  observedAt: number
  server: {
    service: string
    adminPath: string
    configuration: {
      accessTokenTtlSeconds: number
      refreshTokenTtlSeconds: number
      syncMaxPushOps: number
      syncMaxPullChanges: number
    }
    requiredSecrets: Record<string, boolean>
    bindings: Record<string, boolean>
  }
  modules: AdminModule[]
  features: {
    adminAuthentication: boolean
    databaseReadiness: boolean
    databaseMetrics: boolean
    pluginAudit: boolean
    versionMetadata: boolean
  }
}

export interface AdminOverviewMetric {
  key: string
  label: string
  value: number
  unit: 'count'
  status: 'degraded' | 'ok'
  source: { table: string; filter?: string }
  issue?: string
}

export interface AdminActivityItem {
  id: string
  pluginId: string
  jobId?: string
  action: string
  outcome: string
  actorId?: string
  detail?: Record<string, unknown>
  createdAt: number
}

export interface AdminOverview {
  observedAt: number
  health: {
    checkedAt: number
    ready: boolean
    status: 'degraded' | 'ready' | 'unhealthy'
    database: { status: string }
    requiredSecrets: Record<string, boolean>
    issues: string[]
  }
  metrics: AdminOverviewMetric[]
  recentActivity: { available: boolean; items: AdminActivityItem[]; issue?: string }
  deployment: { available: boolean; id: string; tag: string; timestamp: string }
}

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: { code: string; message: string; details?: unknown }
}

export type ApiResponse<T> = ApiFailure | ApiSuccess<T>