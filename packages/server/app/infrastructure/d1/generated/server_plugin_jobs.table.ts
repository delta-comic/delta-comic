import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginJobsTable {
  id: string
  plugin_id: string
  action:
    | 'configure'
    | 'disable'
    | 'enable'
    | 'health'
    | 'install'
    | 'register'
    | 'uninstall'
    | 'update'
  status: 'failed' | 'queued' | 'running' | 'succeeded'
  result_json: string | null
  error_message: string | null
  created_at: number
  started_at: number | null
  completed_at: number | null
  updated_at: number
}

export type ServerPluginJob = Selectable<ServerPluginJobsTable>
export type NewServerPluginJob = Insertable<ServerPluginJobsTable>
export type ServerPluginJobUpdate = Updateable<ServerPluginJobsTable>