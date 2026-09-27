import { logger } from '@delta-comic/logger'

import { type AppEnv, readNumberVar } from '@/env'

import {
  defaultServerRuntimeConfig,
  serverModules,
  type ServerModuleDefinition,
} from '../../../lib/config'

import { D1AdminMetricsRepository, type AdminMetricsRepository } from './admin.repository'
import type {
  AdminCapabilities,
  AdminDeployment,
  AdminOverview,
  AdminReadiness,
  AdminRequiredSecrets,
} from './admin.schemas'

const adminLogger = logger.scoped('server:admin')

const secretConfigured = (value: string | undefined): boolean => Boolean(value?.trim())

const requiredSecrets = (env: AppEnv): AdminRequiredSecrets => ({
  AUTH_PEPPER: secretConfigured(env.AUTH_PEPPER),
  SERVER_ADMIN_TOKEN: secretConfigured(env.SERVER_ADMIN_TOKEN),
  TOKEN_PEPPER: secretConfigured(env.TOKEN_PEPPER),
})

const versionMetadata = (env: AppEnv): AdminDeployment => {
  const metadata = env.CF_VERSION_METADATA
  if (!metadata) return { available: false, id: '', tag: '', timestamp: '' }
  return { available: true, id: metadata.id, tag: metadata.tag, timestamp: metadata.timestamp }
}

const runtimeValues = (env: AppEnv): Record<string, unknown> => ({
  ACCESS_TOKEN_TTL_SECONDS: env.ACCESS_TOKEN_TTL_SECONDS,
  AUTH_PEPPER: env.AUTH_PEPPER,
  CF_VERSION_METADATA: env.CF_VERSION_METADATA,
  DB: env.DB,
  REFRESH_TOKEN_TTL_SECONDS: env.REFRESH_TOKEN_TTL_SECONDS,
  SERVER_ADMIN_TOKEN: env.SERVER_ADMIN_TOKEN,
  SYNC_MAX_PULL_CHANGES: env.SYNC_MAX_PULL_CHANGES,
  SYNC_MAX_PUSH_OPS: env.SYNC_MAX_PUSH_OPS,
  TOKEN_PEPPER: env.TOKEN_PEPPER,
})

const configuredRuntimeValue = (value: unknown): boolean => {
  if (typeof value === 'string') return Boolean(value.trim())
  return value !== null && value !== undefined
}

const describeModuleRuntime = (module: ServerModuleDefinition, env: AppEnv) => {
  const values = runtimeValues(env)
  const bindings = Object.fromEntries(
    module.cloudflareBindings.map(name => [name, configuredRuntimeValue(values[name])]),
  )
  const environment = Object.fromEntries(
    module.workerEnvVars.map(name => [name, configuredRuntimeValue(values[name])]),
  )
  return {
    ...module,
    cloudflareBindings: [...module.cloudflareBindings],
    runtime: {
      available:
        Object.values(bindings).every(Boolean) && Object.values(environment).every(Boolean),
      bindings,
      environment,
    },
    workerEnvVars: [...module.workerEnvVars],
  }
}

const logProbeFailure = (error: unknown) => {
  adminLogger.error('D1 readiness probe failed', error)
}

export class AdminMetricsService {
  constructor(
    private readonly repository: AdminMetricsRepository,
    private readonly env: AppEnv,
    private readonly modules: readonly ServerModuleDefinition[] = serverModules,
    private readonly now: () => number = Date.now,
  ) {}

  capabilities(observedAt = this.now()): AdminCapabilities {
    const metadata = versionMetadata(this.env)
    return {
      features: {
        adminAuthentication: true,
        databaseMetrics: true,
        databaseReadiness: true,
        pluginAudit: true,
        versionMetadata: metadata.available,
      },
      modules: this.modules.map(module => describeModuleRuntime(module, this.env)),
      observedAt,
      server: {
        adminPath: defaultServerRuntimeConfig.adminPath,
        bindings: {
          CF_VERSION_METADATA: metadata.available,
          DB: configuredRuntimeValue(this.env.DB),
        },
        configuration: {
          accessTokenTtlSeconds: readNumberVar(this.env.ACCESS_TOKEN_TTL_SECONDS, 900),
          refreshTokenTtlSeconds: readNumberVar(this.env.REFRESH_TOKEN_TTL_SECONDS, 2_592_000),
          syncMaxPullChanges: readNumberVar(this.env.SYNC_MAX_PULL_CHANGES, 500),
          syncMaxPushOps: readNumberVar(this.env.SYNC_MAX_PUSH_OPS, 100),
        },
        requiredSecrets: requiredSecrets(this.env),
        service: 'delta-comic-server',
      },
    }
  }

  async readiness(checkedAt = this.now()): Promise<AdminReadiness> {
    adminLogger.debug('readiness probe started')
    let databaseHealthy = true
    try {
      await this.repository.probeDatabase()
    } catch (error) {
      databaseHealthy = false
      logProbeFailure(error)
    }

    const secrets = requiredSecrets(this.env)
    const missingSecrets = Object.entries(secrets)
      .filter(([, configured]) => !configured)
      .map(([name]) => name)
    const issues = [
      ...(databaseHealthy ? [] : ['database_unavailable']),
      ...missingSecrets.map(name => `missing_secret:${name}`),
    ]
    const status: AdminReadiness['status'] = !databaseHealthy
      ? 'unhealthy'
      : missingSecrets.length > 0
        ? 'degraded'
        : 'ready'

    adminLogger.info('readiness probe completed', { issueCount: issues.length, status })

    return {
      checkedAt,
      database: { status: databaseHealthy ? 'healthy' : 'unhealthy' },
      issues,
      ready: status === 'ready',
      requiredSecrets: secrets,
      status,
    }
  }

  async overview(observedAt = this.now()): Promise<AdminOverview> {
    const [readiness, metrics, recentActivity] = await Promise.all([
      this.readiness(observedAt),
      this.repository.readMetrics(observedAt),
      this.repository.readRecentPluginAudit(20),
    ])
    const incompleteMetrics =
      metrics.some(metric => metric.status === 'degraded') || !recentActivity.available
    const health: AdminReadiness = incompleteMetrics
      ? {
          ...readiness,
          issues: [...readiness.issues, 'metrics_incomplete'],
          status: readiness.status === 'ready' ? 'degraded' : readiness.status,
        }
      : readiness

    return { deployment: versionMetadata(this.env), health, metrics, observedAt, recentActivity }
  }
}

export const createAdminMetricsService = (env: AppEnv): AdminMetricsService =>
  new AdminMetricsService(new D1AdminMetricsRepository(env.DB), env)