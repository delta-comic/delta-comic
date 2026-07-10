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
  sql: string
  table: string
  values?: (now: number) => readonly unknown[]
}

const metricDefinitions: readonly MetricDefinition[] = [
  {
    key: 'authUsers',
    label: '用户',
    sql: 'SELECT COUNT(*) AS value FROM auth_users',
    table: 'auth_users',
  },
  {
    key: 'authTerminals',
    label: '终端',
    sql: 'SELECT COUNT(*) AS value FROM auth_terminals',
    table: 'auth_terminals',
  },
  {
    filter: 'revoked_at IS NULL AND refresh_expires_at > observedAt',
    key: 'activeAuthSessions',
    label: '活跃会话',
    sql: `SELECT COUNT(*) AS value FROM auth_sessions
          WHERE revoked_at IS NULL AND refresh_expires_at > ?`,
    table: 'auth_sessions',
    values: now => [now],
  },
  {
    key: 'syncEntities',
    label: '同步实体',
    sql: 'SELECT COUNT(*) AS value FROM sync_entities',
    table: 'sync_entities',
  },
  {
    key: 'syncChanges',
    label: '同步变更',
    sql: 'SELECT COUNT(*) AS value FROM sync_changes',
    table: 'sync_changes',
  },
  {
    key: 'pluginRegistry',
    label: '插件注册项',
    sql: 'SELECT COUNT(*) AS value FROM server_plugin_registry',
    table: 'server_plugin_registry',
  },
  {
    key: 'pluginInstallations',
    label: '插件安装项',
    sql: 'SELECT COUNT(*) AS value FROM server_plugin_installations',
    table: 'server_plugin_installations',
  },
  {
    key: 'pluginJobs',
    label: '插件任务',
    sql: 'SELECT COUNT(*) AS value FROM server_plugin_jobs',
    table: 'server_plugin_jobs',
  },
  {
    key: 'pluginAudit',
    label: '插件审计记录',
    sql: 'SELECT COUNT(*) AS value FROM server_plugin_audit',
    table: 'server_plugin_audit',
  },
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

const logQueryFailure = (operation: string, error: unknown) => {
  console.error(
    JSON.stringify({
      error: errorMessage(error),
      message: 'admin metrics query failed',
      operation,
    }),
  )
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
  constructor(private readonly db: D1Database) {}

  async probeDatabase(): Promise<void> {
    const row = await this.db.prepare('SELECT 1 AS ok').first<{ ok: number }>()
    if (row?.ok !== 1) throw new Error('D1 readiness probe returned an unexpected result')
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
          const statement = this.db.prepare(definition.sql)
          const values = definition.values?.(observedAt) ?? []
          const row = await statement.bind(...values).first<CountRow>()
          return availableMetric(definition, Number(row?.value ?? 0))
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
      const result = await this.db
        .prepare(
          `SELECT id, plugin_id, job_id, action, outcome, actor_id, detail_json, created_at
           FROM server_plugin_audit
           ORDER BY created_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(safeLimit)
        .all<PluginAuditRow>()
      return { available: true, items: result.results.map(this.toPluginAudit) }
    } catch (error) {
      logQueryFailure('recent_plugin_audit', error)
      return { available: false, issue: 'query_failed', items: [] }
    }
  }

  private async readExistingTables(names: readonly string[]): Promise<Set<string>> {
    const placeholders = names.map(() => '?').join(', ')
    const result = await this.db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN (${placeholders})`,
      )
      .bind(...names)
      .all<TableNameRow>()
    return new Set(result.results.map(row => row.name))
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