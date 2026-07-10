import { all, first, run } from '@/infrastructure/d1/database'

import type {
  ServerPluginAuditRow,
  ServerPluginInstallationRow,
  ServerPluginJobRow,
  ServerPluginRegistryRow,
  ServerPluginRepositoryContract,
} from './plugins.types'

export class ServerPluginRepository implements ServerPluginRepositoryContract {
  constructor(private readonly db: D1Database) {}

  async listRegistry(): Promise<ServerPluginRegistryRow[]> {
    return await all<ServerPluginRegistryRow>(
      this.db,
      'SELECT * FROM server_plugin_registry ORDER BY plugin_id ASC',
    )
  }

  async findRegistry(pluginId: string): Promise<ServerPluginRegistryRow | null> {
    return await first<ServerPluginRegistryRow>(
      this.db,
      'SELECT * FROM server_plugin_registry WHERE plugin_id = ? LIMIT 1',
      pluginId,
    )
  }

  async saveRegistry(row: ServerPluginRegistryRow): Promise<void> {
    await run(
      this.db,
      `INSERT INTO server_plugin_registry
       (plugin_id, manifest_json, source, trusted, registered_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(plugin_id) DO UPDATE SET
         manifest_json = excluded.manifest_json,
         source = excluded.source,
         trusted = excluded.trusted,
         updated_at = excluded.updated_at`,
      row.plugin_id,
      row.manifest_json,
      row.source,
      row.trusted,
      row.registered_at,
      row.updated_at,
    )
  }

  async removeRegistry(pluginId: string): Promise<void> {
    await run(this.db, 'DELETE FROM server_plugin_registry WHERE plugin_id = ?', pluginId)
  }

  async listInstallations(): Promise<ServerPluginInstallationRow[]> {
    return await all<ServerPluginInstallationRow>(
      this.db,
      'SELECT * FROM server_plugin_installations ORDER BY plugin_id ASC',
    )
  }

  async findInstallation(pluginId: string): Promise<ServerPluginInstallationRow | null> {
    return await first<ServerPluginInstallationRow>(
      this.db,
      'SELECT * FROM server_plugin_installations WHERE plugin_id = ? LIMIT 1',
      pluginId,
    )
  }

  async saveInstallation(row: ServerPluginInstallationRow): Promise<void> {
    await run(
      this.db,
      `INSERT INTO server_plugin_installations
       (plugin_id, installed_version, desired_state, observed_state, config_json,
        installed_at, updated_at, last_error, last_health_json, last_health_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(plugin_id) DO UPDATE SET
         installed_version = excluded.installed_version,
         desired_state = excluded.desired_state,
         observed_state = excluded.observed_state,
         config_json = excluded.config_json,
         updated_at = excluded.updated_at,
         last_error = excluded.last_error,
         last_health_json = excluded.last_health_json,
         last_health_at = excluded.last_health_at`,
      row.plugin_id,
      row.installed_version,
      row.desired_state,
      row.observed_state,
      row.config_json,
      row.installed_at,
      row.updated_at,
      row.last_error,
      row.last_health_json,
      row.last_health_at,
    )
  }

  async removeInstallation(pluginId: string): Promise<void> {
    await run(this.db, 'DELETE FROM server_plugin_installations WHERE plugin_id = ?', pluginId)
  }

  async listJobs(limit: number): Promise<ServerPluginJobRow[]> {
    return await all<ServerPluginJobRow>(
      this.db,
      'SELECT * FROM server_plugin_jobs ORDER BY created_at DESC, id DESC LIMIT ?',
      limit,
    )
  }

  async findJob(jobId: string): Promise<ServerPluginJobRow | null> {
    return await first<ServerPluginJobRow>(
      this.db,
      'SELECT * FROM server_plugin_jobs WHERE id = ? LIMIT 1',
      jobId,
    )
  }

  async saveJob(row: ServerPluginJobRow): Promise<void> {
    await run(
      this.db,
      `INSERT INTO server_plugin_jobs
       (id, plugin_id, action, status, result_json, error_message, created_at,
        started_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         result_json = excluded.result_json,
         error_message = excluded.error_message,
         started_at = excluded.started_at,
         completed_at = excluded.completed_at,
         updated_at = excluded.updated_at`,
      row.id,
      row.plugin_id,
      row.action,
      row.status,
      row.result_json,
      row.error_message,
      row.created_at,
      row.started_at,
      row.completed_at,
      row.updated_at,
    )
  }

  async listAudit(limit: number): Promise<ServerPluginAuditRow[]> {
    return await all<ServerPluginAuditRow>(
      this.db,
      'SELECT * FROM server_plugin_audit ORDER BY created_at DESC, id DESC LIMIT ?',
      limit,
    )
  }

  async saveAudit(row: ServerPluginAuditRow): Promise<void> {
    await run(
      this.db,
      `INSERT INTO server_plugin_audit
       (id, plugin_id, job_id, action, outcome, actor_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.plugin_id,
      row.job_id,
      row.action,
      row.outcome,
      row.actor_id,
      row.detail_json,
      row.created_at,
    )
  }
}