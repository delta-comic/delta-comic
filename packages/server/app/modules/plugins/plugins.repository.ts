import {
  serverPluginAuditRowSchema,
  serverPluginInstallationsRowSchema,
  serverPluginJobsRowSchema,
  serverPluginRegistryRowSchema,
} from '@/infrastructure/d1/generated/schemas'
import { createKysely } from '@/infrastructure/d1/kysely'
import { assertDatabaseRead, assertDatabaseWrite } from '@/infrastructure/d1/validation'

import type {
  ServerPluginAuditRow,
  ServerPluginInstallationRow,
  ServerPluginJobRow,
  ServerPluginRegistryRow,
  ServerPluginRepositoryContract,
} from './plugins.types'

export class ServerPluginRepository implements ServerPluginRepositoryContract {
  private readonly kysely

  constructor(db: D1Database) {
    this.kysely = createKysely(db)
  }

  async listRegistry(): Promise<ServerPluginRegistryRow[]> {
    return await this.kysely
      .selectFrom('server_plugin_registry')
      .selectAll()
      .orderBy('plugin_id', 'asc')
      .execute()
      .then(rows =>
        rows.map(row =>
          assertDatabaseRead(serverPluginRegistryRowSchema, 'server_plugin_registry', row),
        ),
      )
  }

  async findRegistry(pluginId: string): Promise<ServerPluginRegistryRow | null> {
    return await this.kysely
      .selectFrom('server_plugin_registry')
      .selectAll()
      .where('plugin_id', '=', pluginId)
      .executeTakeFirst()
      .then(row =>
        row
          ? assertDatabaseRead(serverPluginRegistryRowSchema, 'server_plugin_registry', row)
          : null,
      )
  }

  async saveRegistry(row: ServerPluginRegistryRow): Promise<void> {
    await this.kysely
      .insertInto('server_plugin_registry')
      .values(assertDatabaseWrite(serverPluginRegistryRowSchema, 'server_plugin_registry', row))
      .onConflict(oc =>
        oc
          .column('plugin_id')
          .doUpdateSet({
            manifest_json: row.manifest_json,
            source: row.source,
            trusted: row.trusted,
            updated_at: row.updated_at,
          }),
      )
      .execute()
  }

  async removeRegistry(pluginId: string): Promise<void> {
    await this.kysely
      .deleteFrom('server_plugin_registry')
      .where('plugin_id', '=', pluginId)
      .execute()
  }

  async listInstallations(): Promise<ServerPluginInstallationRow[]> {
    return await this.kysely
      .selectFrom('server_plugin_installations')
      .selectAll()
      .orderBy('plugin_id', 'asc')
      .execute()
      .then(rows =>
        rows.map(row =>
          assertDatabaseRead(
            serverPluginInstallationsRowSchema,
            'server_plugin_installations',
            row,
          ),
        ),
      )
  }

  async findInstallation(pluginId: string): Promise<ServerPluginInstallationRow | null> {
    return await this.kysely
      .selectFrom('server_plugin_installations')
      .selectAll()
      .where('plugin_id', '=', pluginId)
      .executeTakeFirst()
      .then(row =>
        row
          ? assertDatabaseRead(
              serverPluginInstallationsRowSchema,
              'server_plugin_installations',
              row,
            )
          : null,
      )
  }

  async saveInstallation(row: ServerPluginInstallationRow): Promise<void> {
    await this.kysely
      .insertInto('server_plugin_installations')
      .values(
        assertDatabaseWrite(serverPluginInstallationsRowSchema, 'server_plugin_installations', row),
      )
      .onConflict(oc =>
        oc
          .column('plugin_id')
          .doUpdateSet({
            config_json: row.config_json,
            desired_state: row.desired_state,
            installed_version: row.installed_version,
            last_error: row.last_error,
            last_health_at: row.last_health_at,
            last_health_json: row.last_health_json,
            observed_state: row.observed_state,
            updated_at: row.updated_at,
          }),
      )
      .execute()
  }

  async removeInstallation(pluginId: string): Promise<void> {
    await this.kysely
      .deleteFrom('server_plugin_installations')
      .where('plugin_id', '=', pluginId)
      .execute()
  }

  async listJobs(limit: number): Promise<ServerPluginJobRow[]> {
    return await this.kysely
      .selectFrom('server_plugin_jobs')
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .execute()
      .then(rows =>
        rows.map(row => assertDatabaseRead(serverPluginJobsRowSchema, 'server_plugin_jobs', row)),
      )
  }

  async findJob(jobId: string): Promise<ServerPluginJobRow | null> {
    return await this.kysely
      .selectFrom('server_plugin_jobs')
      .selectAll()
      .where('id', '=', jobId)
      .executeTakeFirst()
      .then(row =>
        row ? assertDatabaseRead(serverPluginJobsRowSchema, 'server_plugin_jobs', row) : null,
      )
  }

  async saveJob(row: ServerPluginJobRow): Promise<void> {
    await this.kysely
      .insertInto('server_plugin_jobs')
      .values(assertDatabaseWrite(serverPluginJobsRowSchema, 'server_plugin_jobs', row))
      .onConflict(oc =>
        oc
          .column('id')
          .doUpdateSet({
            completed_at: row.completed_at,
            error_message: row.error_message,
            result_json: row.result_json,
            started_at: row.started_at,
            status: row.status,
            updated_at: row.updated_at,
          }),
      )
      .execute()
  }

  async listAudit(limit: number): Promise<ServerPluginAuditRow[]> {
    return await this.kysely
      .selectFrom('server_plugin_audit')
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .execute()
      .then(rows =>
        rows.map(row => assertDatabaseRead(serverPluginAuditRowSchema, 'server_plugin_audit', row)),
      )
  }

  async saveAudit(row: ServerPluginAuditRow): Promise<void> {
    await this.kysely
      .insertInto('server_plugin_audit')
      .values(assertDatabaseWrite(serverPluginAuditRowSchema, 'server_plugin_audit', row))
      .execute()
  }
}