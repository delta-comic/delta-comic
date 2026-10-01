import { first } from '@/infrastructure/d1/database'
import { createKysely, type ServerDatabase } from '@/infrastructure/d1/kysely'

import type { ServerPluginHost, ServerPluginHostMetric } from '../../../lib/plugin'
import { ServerRuntime, type ServerRuntimeOptions } from '../../../lib/serverRuntime'

const metricSql = {
  'auth.activeSessions': `SELECT COUNT(*) AS value
    FROM auth_sessions
    WHERE revoked_at IS NULL AND refresh_expires_at > ?`,
  'sync.changeCount': 'SELECT COUNT(*) AS value FROM sync_changes',
  'sync.cursorBacklog': `SELECT COALESCE(MAX(latest.latest_seq - cursor.last_pulled_seq), 0) AS value
    FROM sync_terminal_cursors AS cursor
    JOIN (
      SELECT user_id, MAX(server_seq) AS latest_seq
      FROM sync_changes
      GROUP BY user_id
    ) AS latest ON latest.user_id = cursor.user_id`,
} as const satisfies Record<ServerPluginHostMetric, string>

export class D1ServerPluginHost implements ServerPluginHost {
  constructor(private readonly db: D1Database) {}

  async probeDatabase(): Promise<boolean> {
    const result = await first<{ value: number }>(this.db, 'SELECT 1 AS value')
    return result?.value === 1
  }

  async readMetric(metric: ServerPluginHostMetric): Promise<number> {
    const sql = metricSql[metric]
    const row =
      metric === 'auth.activeSessions'
        ? await first<{ value: number }>(this.db, sql, Date.now())
        : await first<{ value: number }>(this.db, sql)
    return Number(row?.value ?? 0)
  }
}

export type AppServerRuntimeOptions = Omit<
  ServerRuntimeOptions<ServerDatabase>,
  'db' | 'pluginHost'
>

export const createAppServerRuntime = (
  database: D1Database,
  options: AppServerRuntimeOptions,
): ServerRuntime<ServerDatabase> =>
  new ServerRuntime({
    ...options,
    db: createKysely(database),
    pluginHost: new D1ServerPluginHost(database),
  })