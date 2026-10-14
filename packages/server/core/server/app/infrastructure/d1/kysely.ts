import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'

import type { AuthSessionsTable } from './generated/auth_sessions.table'
import type { AuthTerminalsTable } from './generated/auth_terminals.table'
import type { AuthUsersTable } from './generated/auth_users.table'
import type { ServerPluginPackagesTable } from './generated/server_plugin_packages.table'
import type { ServerPluginRunsTable } from './generated/server_plugin_runs.table'
import type { ServerPluginSchedulesTable } from './generated/server_plugin_schedules.table'
import type { ServerPluginStoreTable } from './generated/server_plugin_store.table'
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
  server_plugin_packages: ServerPluginPackagesTable
  server_plugin_schedules: ServerPluginSchedulesTable
  server_plugin_runs: ServerPluginRunsTable
  server_plugin_store: ServerPluginStoreTable
}

export const createKysely = (database: D1Database): Kysely<ServerDatabase> =>
  new Kysely<ServerDatabase>({ dialect: new D1Dialect({ database }) })