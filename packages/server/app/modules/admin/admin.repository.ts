import { logger } from '@delta-comic/logger'
import { sql } from 'kysely'

import { createKysely } from '@/infrastructure/d1/kysely'
import type { ServerDatabase } from '@/infrastructure/d1/kysely'

import type {
  AdminMetric,
  AdminMetricIssue,
  AdminPluginAudit,
  AdminRecentActivity,
} from './admin.schemas'

interface CountRow {
  value: number
}

interface TableNameRow {
  name: string
}

interface PluginAuditRow {
  action: string
  actor_id: string | null
  created_at: number
  detail_json: string | null
  id: string
  job_id: string | null
  outcome: string
  plugin_id: string
}

interface MetricDefinition {
  filter?: string
  key: AdminMetric['key']
  label: string
  table: keyof ServerDatabase
}

const metricDefinitions: readonly MetricDefinition[] = [
  { key: 'authUsers', label: '用户', table: 'auth_users' },
  { key: 'authTerminals', label: '终端', table: 'auth_terminals' },
  {
    filter: 'revoked_at IS NULL AND refresh_expires_at > observedAt',
    key: 'activeAuthSessions',
    label: '活跃会话',
    table: 'auth_sessions',
  },
  { key: 'syncEntities', label: '同步实体', table: 'sync_entities' },
  { key: 'syncChanges', label: '同步变更', table: 'sync_changes' },
  { key: 'pluginRegistry', label: '插件注册项', table: 'server_plugin_registry' },
  { key: 'pluginInstallations', label: '插件安装项', table: 'server_plugin_installations' },
  { key: 'pluginJobs', label: '插件任务', table: 'server_plugin_jobs' },
  { key: 'pluginAudit', label: '插件审计记录', table: 'server_plugin_audit' },
]

const unavailableMetric = (definition: MetricDefinition, issue: AdminMetricIssue): AdminMetric => ({
  issue,
  key: definition.key,
  label: definition.label,
  source: { ...(definition.filter ? { filter: definition.filter } : {}), table: definition.table },
  status: 'degraded',
  unit: 'count',
  value: 0,
})

const availableMetric = (definition: MetricDefinition, value: number): AdminMetric => ({
  key: definition.key,
  label: definition.label,
  source: { ...(definition.filter ? { filter: definition.filter } : {}), table: definition.table },
  status: 'ok',
  unit: 'count',
  value: Math.max(0, value),
})

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const metricsLogger = logger.scoped('server:admin:metrics')

const logQueryFailure = (operation: string, error: unknown) => {
  metricsLogger.error('admin metrics query failed', { error: errorMessage(error), operation })
}

const parseAuditDetail = (value: string | null): unknown => {
  if (!value) return undefined
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

export interface AdminMetricsRepository {
  probeDatabase(): Promise<void>
  readMetrics(observedAt: number): Promise<AdminMetric[]>
  readRecentPluginAudit(limit: number): Promise<AdminRecentActivity>
}

export class D1AdminMetricsRepository implements AdminMetricsRepository {
  private readonly kysely

  constructor(db: D1Database) {
    this.kysely = createKysely(db)
  }

  async probeDatabase(): Promise<void> {
    const result = await sql<{ ok: number }>`select 1 as ok`.execute(this.kysely)
    if (result.rows[0]?.ok !== 1)
      throw new Error('D1 readiness probe returned an unexpected result')
  }

  async readMetrics(observedAt: number): Promise<AdminMetric[]> {
    let tables: Set<string>
    try {
      tables = await this.readExistingTables(metricDefinitions.map(metric => metric.table))
    } catch (error) {
      logQueryFailure('list_metric_tables', error)
      return metricDefinitions.map(definition => unavailableMetric(definition, 'query_failed'))
    }

    return await Promise.all(
      metricDefinitions.map(async definition => {
        if (!tables.has(definition.table)) return unavailableMetric(definition, 'table_missing')
        try {
          const row = await this.readMetric(definition, observedAt)
          return availableMetric(definition, row?.value ?? 0)
        } catch (error) {
          logQueryFailure(`count:${definition.key}`, error)
          return unavailableMetric(definition, 'query_failed')
        }
      }),
    )
  }

  async readRecentPluginAudit(limit: number): Promise<AdminRecentActivity> {
    let tables: Set<string>
    try {
      tables = await this.readExistingTables(['server_plugin_audit'])
    } catch (error) {
      logQueryFailure('inspect_plugin_audit_table', error)
      return { available: false, issue: 'query_failed', items: [] }
    }
    if (!tables.has('server_plugin_audit')) {
      return { available: false, issue: 'table_missing', items: [] }
    }

    try {
      const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
      const result = await this.kysely
        .selectFrom('server_plugin_audit')
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(safeLimit)
        .execute()
      return { available: true, items: result.map(this.toPluginAudit) }
    } catch (error) {
      logQueryFailure('recent_plugin_audit', error)
      return { available: false, issue: 'query_failed', items: [] }
    }
  }

  private async readExistingTables(names: readonly string[]): Promise<Set<string>> {
    const result = await sql<TableNameRow>`select name from sqlite_master
      where type = 'table' and name in (${sql.join(names)})`.execute(this.kysely)
    return new Set(result.rows.map(row => row.name))
  }

  private async readMetric(
    definition: MetricDefinition,
    observedAt: number,
  ): Promise<CountRow | undefined> {
    const count = (table: keyof ServerDatabase) =>
      this.kysely
        .selectFrom(table)
        .select(eb => eb.fn.countAll<number>().as('value'))
        .$if(definition.key === 'activeAuthSessions', qb =>
          qb.where('revoked_at', 'is', null).where('refresh_expires_at', '>', observedAt),
        )
        .executeTakeFirst()
    return await count(definition.table as keyof ServerDatabase)
  }

  private readonly toPluginAudit = (row: PluginAuditRow): AdminPluginAudit => {
    const detail = parseAuditDetail(row.detail_json)
    return {
      action: row.action,
      ...(row.actor_id ? { actorId: row.actor_id } : {}),
      createdAt: row.created_at,
      ...(detail === undefined ? {} : { detail }),
      id: row.id,
      ...(row.job_id ? { jobId: row.job_id } : {}),
      outcome: row.outcome,
      pluginId: row.plugin_id,
    }
  }
}