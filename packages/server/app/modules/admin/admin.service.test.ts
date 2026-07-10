import { describe, expect, it, vi } from 'vitest'

import type { AppEnv } from '@/env'

import type { AdminMetricsRepository } from './admin.repository'
import type { AdminMetric, AdminRecentActivity } from './admin.schemas'
import { AdminMetricsService } from './admin.service'

const healthyMetric: AdminMetric = {
  key: 'authUsers',
  label: '用户',
  source: { table: 'auth_users' },
  status: 'ok',
  unit: 'count',
  value: 12,
}

const missingPluginMetric: AdminMetric = {
  issue: 'table_missing',
  key: 'pluginRegistry',
  label: '插件注册项',
  source: { table: 'server_plugin_registry' },
  status: 'degraded',
  unit: 'count',
  value: 0,
}

class FakeAdminMetricsRepository implements AdminMetricsRepository {
  metrics: AdminMetric[] = [healthyMetric]
  recentActivity: AdminRecentActivity = { available: true, items: [] }
  probeError?: Error

  async probeDatabase(): Promise<void> {
    if (this.probeError) throw this.probeError
  }

  async readMetrics(): Promise<AdminMetric[]> {
    return this.metrics
  }

  async readRecentPluginAudit(): Promise<AdminRecentActivity> {
    return this.recentActivity
  }
}

const createEnv = (overrides: Partial<AppEnv> = {}): AppEnv => ({
  ACCESS_TOKEN_TTL_SECONDS: '900',
  AUTH_PEPPER: 'auth-pepper',
  CF_VERSION_METADATA: { id: 'version-id', tag: 'test', timestamp: '2026-07-10T00:00:00Z' },
  DB: {} as D1Database,
  REFRESH_TOKEN_TTL_SECONDS: '2592000',
  SERVER_ADMIN_TOKEN: 'admin-secret',
  SYNC_MAX_PULL_CHANGES: '500',
  SYNC_MAX_PUSH_OPS: '100',
  TOKEN_PEPPER: 'token-pepper',
  ...overrides,
})

const observedAt = 1_783_641_600_000

describe('AdminMetricsService', () => {
  it('describes configured limits, bindings, secrets, modules, and deployment metadata', () => {
    const repository = new FakeAdminMetricsRepository()
    const service = new AdminMetricsService(repository, createEnv(), undefined, () => observedAt)

    const result = service.capabilities()

    expect(result.observedAt).toBe(observedAt)
    expect(result.server.configuration).toEqual({
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 2_592_000,
      syncMaxPullChanges: 500,
      syncMaxPushOps: 100,
    })
    expect(result.server.requiredSecrets).toEqual({
      AUTH_PEPPER: true,
      SERVER_ADMIN_TOKEN: true,
      TOKEN_PEPPER: true,
    })
    expect(result.server.bindings).toEqual({ CF_VERSION_METADATA: true, DB: true })
    expect(result.modules.find(module => module.key === 'admin')?.runtime.available).toBe(true)
    expect(result.features.versionMetadata).toBe(true)
  })

  it('keeps missing plugin tables and audit data as degraded zero-value observations', async () => {
    const repository = new FakeAdminMetricsRepository()
    repository.metrics = [healthyMetric, missingPluginMetric]
    repository.recentActivity = { available: false, issue: 'table_missing', items: [] }
    const service = new AdminMetricsService(repository, createEnv(), undefined, () => observedAt)

    const result = await service.overview()

    expect(result.health).toMatchObject({
      issues: ['metrics_incomplete'],
      ready: true,
      status: 'degraded',
    })
    expect(result.metrics).toContainEqual(missingPluginMetric)
    expect(result.recentActivity).toEqual({ available: false, issue: 'table_missing', items: [] })
    expect(result.deployment).toEqual({
      available: true,
      id: 'version-id',
      tag: 'test',
      timestamp: '2026-07-10T00:00:00Z',
    })
  })

  it('marks readiness unhealthy when the real database probe fails', async () => {
    const repository = new FakeAdminMetricsRepository()
    repository.probeError = new Error('database unavailable')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = new AdminMetricsService(repository, createEnv(), undefined, () => observedAt)

    const result = await service.readiness()

    expect(result).toMatchObject({
      database: { status: 'unhealthy' },
      issues: ['database_unavailable'],
      ready: false,
      status: 'unhealthy',
    })
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })

  it('reports missing required secrets without exposing their values', async () => {
    const repository = new FakeAdminMetricsRepository()
    const service = new AdminMetricsService(
      repository,
      createEnv({ TOKEN_PEPPER: undefined }),
      undefined,
      () => observedAt,
    )

    const result = await service.readiness()

    expect(result.status).toBe('degraded')
    expect(result.ready).toBe(false)
    expect(result.requiredSecrets.TOKEN_PEPPER).toBe(false)
    expect(result.issues).toContain('missing_secret:TOKEN_PEPPER')
    expect(JSON.stringify(result)).not.toContain('token-pepper')
  })
})