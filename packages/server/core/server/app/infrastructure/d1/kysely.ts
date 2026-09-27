import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'

import type { AuthSessionsTable } from './generated/auth_sessions.table'
import type { AuthTerminalsTable } from './generated/auth_terminals.table'
import type { AuthUsersTable } from './generated/auth_users.table'
import type { ServerPluginAuditTable } from './generated/server_plugin_audit.table'
import type { ServerPluginInstallationsTable } from './generated/server_plugin_installations.table'
import type { ServerPluginJobsTable } from './generated/server_plugin_jobs.table'
import type { ServerPluginRegistryTable } from './generated/server_plugin_registry.table'
import type { ServerPluginScriptRunsTable } from './generated/server_plugin_script_runs.table'
import type { ServerPluginScriptsTable } from './generated/server_plugin_scripts.table'
import type { SyncChangesTable } from './generated/sync_changes.table'
import type { SyncEntitiesTable } from './generated/sync_entities.table'
import type { SyncOpsTable } from './generated/sync_ops.table'
import type { SyncTerminalCursorsTable } from './generated/sync_terminal_cursors.table'

export interface ServerDatabase {
  auth_users: AuthUsersTable
  auth_terminals: AuthTerminalsTable
  auth_sessions: AuthSessionsTable
  sync_entities: SyncEntitiesTable
  sync_changes: SyncChangesTable
  sync_ops: SyncOpsTable
  sync_terminal_cursors: SyncTerminalCursorsTable
  server_plugin_registry: ServerPluginRegistryTable
  server_plugin_installations: ServerPluginInstallationsTable
  server_plugin_jobs: ServerPluginJobsTable
  server_plugin_audit: ServerPluginAuditTable
  server_plugin_scripts: ServerPluginScriptsTable
  server_plugin_script_runs: ServerPluginScriptRunsTable
}

export const createKysely = (database: D1Database): Kysely<ServerDatabase> =>
  new Kysely<ServerDatabase>({ dialect: new D1Dialect({ database }) })