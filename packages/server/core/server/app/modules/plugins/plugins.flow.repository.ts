import { parsePluginManifest } from '@delta-comic/plugin-manifest'

import type { ServerPluginPackage } from '@/infrastructure/d1/generated/server_plugin_packages.table'
import type { ServerPluginRun } from '@/infrastructure/d1/generated/server_plugin_runs.table'
import type { ServerPluginSchedule } from '@/infrastructure/d1/generated/server_plugin_schedules.table'

import type { FlowInstallation, FlowRun, FlowStore } from '../../../lib/flow'
import { parseFlowDocument } from '../../../lib/flow'

const decode = (row: ServerPluginPackage, schedule?: ServerPluginSchedule): FlowInstallation => ({
  manifest: parsePluginManifest(JSON.parse(row.manifest_json)),
  document: parseFlowDocument(JSON.parse(row.document_json)),
  config: JSON.parse(row.config_json),
  enabled: row.enabled === 1,
  ...(schedule
    ? {
        schedule: {
          flowId: schedule.flow_id,
          enabled: schedule.enabled === 1,
          intervalHours: schedule.interval_hours,
          nextRunAt: schedule.next_run_at,
        },
      }
    : {}),
})

export class FlowRepository {
  constructor(
    readonly db: D1Database,
    readonly tenantId: string,
  ) {}

  async list(): Promise<FlowInstallation[]> {
    const [packages, schedules] = await Promise.all([
      this.db
        .prepare('SELECT * FROM server_plugin_packages WHERE tenant_id = ? ORDER BY plugin_id')
        .bind(this.tenantId)
        .all<ServerPluginPackage>(),
      this.db
        .prepare('SELECT * FROM server_plugin_schedules WHERE tenant_id = ?')
        .bind(this.tenantId)
        .all<ServerPluginSchedule>(),
    ])
    return packages.results.map(row =>
      decode(
        row,
        schedules.results.find(schedule => schedule.plugin_id === row.plugin_id),
      ),
    )
  }

  async find(pluginId: string): Promise<FlowInstallation | null> {
    const row = await this.db
      .prepare('SELECT * FROM server_plugin_packages WHERE tenant_id = ? AND plugin_id = ?')
      .bind(this.tenantId, pluginId)
      .first<ServerPluginPackage>()
    if (!row) return null
    const schedule = await this.db
      .prepare('SELECT * FROM server_plugin_schedules WHERE tenant_id = ? AND plugin_id = ?')
      .bind(this.tenantId, pluginId)
      .first<ServerPluginSchedule>()
    return decode(row, schedule ?? undefined)
  }

  async save(pluginId: string, installation: FlowInstallation): Promise<void> {
    const now = Date.now()
    const statements = [
      this.db
        .prepare(`INSERT INTO server_plugin_packages
      (tenant_id, plugin_id, manifest_json, document_json, config_json, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, plugin_id) DO UPDATE SET manifest_json = excluded.manifest_json,
      document_json = excluded.document_json, config_json = excluded.config_json,
      enabled = excluded.enabled, updated_at = excluded.updated_at`)
        .bind(
          this.tenantId,
          pluginId,
          JSON.stringify(installation.manifest),
          JSON.stringify(installation.document),
          JSON.stringify(installation.config),
          Number(installation.enabled),
          now,
          now,
        ),
    ]
    const schedule = installation.schedule
    if (schedule)
      statements.push(
        this.db
          .prepare(`INSERT INTO server_plugin_schedules
      (tenant_id, plugin_id, flow_id, enabled, interval_hours, next_run_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, plugin_id) DO UPDATE SET flow_id = excluded.flow_id,
      enabled = excluded.enabled, interval_hours = excluded.interval_hours,
      next_run_at = excluded.next_run_at, updated_at = excluded.updated_at`)
          .bind(
            this.tenantId,
            pluginId,
            schedule.flowId,
            Number(schedule.enabled),
            schedule.intervalHours,
            schedule.nextRunAt ?? now + schedule.intervalHours * 3_600_000,
            now,
          ),
      )
    else
      statements.push(
        this.db
          .prepare('DELETE FROM server_plugin_schedules WHERE tenant_id = ? AND plugin_id = ?')
          .bind(this.tenantId, pluginId),
      )
    await this.db.batch(statements)
  }

  async remove(pluginId: string): Promise<void> {
    await this.db.batch([
      this.db
        .prepare('DELETE FROM server_plugin_runs WHERE tenant_id = ? AND plugin_id = ?')
        .bind(this.tenantId, pluginId),
      this.db
        .prepare('DELETE FROM server_plugin_packages WHERE tenant_id = ? AND plugin_id = ?')
        .bind(this.tenantId, pluginId),
    ])
  }

  store(pluginId: string): FlowStore {
    return {
      get: async key => {
        const row = await this.db
          .prepare(
            'SELECT value_json FROM server_plugin_store WHERE tenant_id = ? AND plugin_id = ? AND key = ?',
          )
          .bind(this.tenantId, pluginId, key)
          .first<{ value_json: string }>()
        return row ? JSON.parse(row.value_json) : null
      },
      set: async (key, value) => {
        const json = JSON.stringify(value)
        if (json === undefined) throw new TypeError('store value must be JSON')
        await this.db
          .prepare(`INSERT INTO server_plugin_store (tenant_id, plugin_id, key, value_json) VALUES (?, ?, ?, ?)
          ON CONFLICT(tenant_id, plugin_id, key) DO UPDATE SET value_json = excluded.value_json`)
          .bind(this.tenantId, pluginId, key, json)
          .run()
      },
      delete: async key => {
        await this.db
          .prepare(
            'DELETE FROM server_plugin_store WHERE tenant_id = ? AND plugin_id = ? AND key = ?',
          )
          .bind(this.tenantId, pluginId, key)
          .run()
      },
    }
  }

  async saveRun(run: FlowRun): Promise<void> {
    await this.db
      .prepare(`INSERT INTO server_plugin_runs
      (id, tenant_id, plugin_id, flow_id, trigger, status, input_json, result_json, step_id, error_message, metrics_json, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, result_json = excluded.result_json,
      step_id = excluded.step_id, error_message = excluded.error_message,
      metrics_json = excluded.metrics_json, completed_at = excluded.completed_at`)
      .bind(
        run.id,
        this.tenantId,
        run.pluginId,
        run.flowId,
        run.trigger,
        run.status,
        JSON.stringify(run.input) ?? null,
        JSON.stringify(run.result) ?? null,
        run.stepId ?? null,
        run.error ?? null,
        JSON.stringify(run.metrics),
        run.startedAt,
        run.completedAt ?? null,
      )
      .run()
  }

  async listRuns(pluginId: string): Promise<FlowRun[]> {
    const rows = await this.db
      .prepare(
        'SELECT * FROM server_plugin_runs WHERE tenant_id = ? AND plugin_id = ? ORDER BY started_at DESC, id DESC LIMIT 30',
      )
      .bind(this.tenantId, pluginId)
      .all<ServerPluginRun>()
    return rows.results.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      pluginId: row.plugin_id,
      flowId: row.flow_id,
      trigger: row.trigger,
      status: row.status,
      input: row.input_json ? JSON.parse(row.input_json) : null,
      result: row.result_json ? JSON.parse(row.result_json) : null,
      stepId: row.step_id ?? undefined,
      error: row.error_message ?? undefined,
      metrics: JSON.parse(row.metrics_json),
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
    }))
  }
}

export const claimDueFlows = async (
  db: D1Database,
  now: number,
): Promise<ServerPluginSchedule[]> => {
  const result = await db
    .prepare(`UPDATE server_plugin_schedules
    SET next_run_at = ? + interval_hours * 3600000, updated_at = ?
    WHERE (tenant_id, plugin_id) IN (
      SELECT s.tenant_id, s.plugin_id FROM server_plugin_schedules s
      JOIN server_plugin_packages p ON p.tenant_id = s.tenant_id AND p.plugin_id = s.plugin_id
      WHERE s.enabled = 1 AND p.enabled = 1 AND s.next_run_at <= ?
      ORDER BY s.next_run_at LIMIT 20
    ) RETURNING *`)
    .bind(now, now, now)
    .all<ServerPluginSchedule>()
  return result.results
}