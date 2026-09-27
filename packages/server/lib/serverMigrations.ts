import type { ServerMigrationResource, ServerPluginArtifactManifest } from './serverManifest'

export interface ServerSqlMigrationFile {
  readonly path: string
  readonly content: string | Uint8Array
}

export interface ServerSqlMigrationResult {
  readonly applied: readonly string[]
  readonly skipped: readonly string[]
}

interface MigrationRow {
  migration_id: string
}

const migrationTable = `CREATE TABLE IF NOT EXISTS dc_plugin_migrations (
  plugin_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  migration_id TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, installation_id, migration_id)
)`

const decode = (content: string | Uint8Array): string =>
  typeof content === 'string' ? content : new TextDecoder().decode(content)

const resourceById = (
  resources: readonly ServerMigrationResource[] | undefined,
): Map<string, ServerMigrationResource> =>
  new Map(resources?.map(resource => [resource.id, resource]))

const fileByPath = (
  files: readonly ServerSqlMigrationFile[],
): Map<string, ServerSqlMigrationFile> => new Map(files.map(file => [file.path, file]))

export const applyServerSqlMigrations = async (
  database: D1Database,
  pluginId: string,
  installationId: string,
  manifest: ServerPluginArtifactManifest,
  files: readonly ServerSqlMigrationFile[],
): Promise<ServerSqlMigrationResult> => {
  const resources = resourceById(manifest.migrationResources)
  const fileMap = fileByPath(files)
  const declared = new Set(manifest.migrations)
  const resourceIds = [...resources.keys()]
  const undeclared = resourceIds.filter(id => !declared.has(id))
  const missing = manifest.migrations.filter(id => !resources.has(id))
  if (undeclared.length > 0 || missing.length > 0) {
    throw new Error(
      `SQL migration resource mismatch (undeclared: ${undeclared.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`,
    )
  }

  await database.exec(migrationTable)
  const appliedRows = await database
    .prepare(
      'SELECT migration_id FROM dc_plugin_migrations WHERE plugin_id = ? AND installation_id = ?',
    )
    .bind(pluginId, installationId)
    .all<MigrationRow>()
  const appliedIds = new Set(appliedRows.results.map(row => row.migration_id))
  const applied: string[] = []
  const skipped: string[] = []

  for (const migrationId of manifest.migrations) {
    if (appliedIds.has(migrationId)) {
      skipped.push(migrationId)
      continue
    }
    const resource = resources.get(migrationId)
    const file = resource === undefined ? undefined : fileMap.get(resource.path)
    if (!resource || !file) throw new Error(`SQL migration file is missing: ${migrationId}`)
    await database.exec(decode(file.content))
    await database
      .prepare(
        'INSERT INTO dc_plugin_migrations (plugin_id, installation_id, migration_id, applied_at) VALUES (?, ?, ?, ?)',
      )
      .bind(pluginId, installationId, migrationId, Date.now())
      .run()
    applied.push(migrationId)
  }

  return { applied, skipped }
}