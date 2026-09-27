import type {
  ServerPluginAction,
  ServerPluginDesiredState,
  ServerPluginJobStatus,
} from '../../../lib/plugin'

export interface ServerPluginRegistryRow {
  plugin_id: string
  manifest_json: string
  source: string
  trusted: number
  registered_at: number
  updated_at: number
}

export interface ServerPluginInstallationRow {
  plugin_id: string
  installed_version: string
  desired_state: Exclude<ServerPluginDesiredState, 'uninstalled'>
  observed_state: 'disabled' | 'enabled' | 'failed' | 'installed'
  config_json: string
  installed_at: number
  updated_at: number
  last_error: string | null
  last_health_json: string | null
  last_health_at: number | null
}

export interface ServerPluginJobRow {
  id: string
  plugin_id: string
  action: ServerPluginAction
  status: ServerPluginJobStatus
  result_json: string | null
  error_message: string | null
  created_at: number
  started_at: number | null
  completed_at: number | null
  updated_at: number
}

export interface ServerPluginAuditRow {
  id: string
  plugin_id: string
  job_id: string
  action: ServerPluginAction
  outcome: 'failed' | 'succeeded'
  actor_id: string
  detail_json: string | null
  created_at: number
}

export interface ServerPluginRepositoryContract {
  listRegistry(): Promise<ServerPluginRegistryRow[]>
  findRegistry(pluginId: string): Promise<ServerPluginRegistryRow | null>
  saveRegistry(row: ServerPluginRegistryRow): Promise<void>
  removeRegistry(pluginId: string): Promise<void>
  listInstallations(): Promise<ServerPluginInstallationRow[]>
  findInstallation(pluginId: string): Promise<ServerPluginInstallationRow | null>
  saveInstallation(row: ServerPluginInstallationRow): Promise<void>
  removeInstallation(pluginId: string): Promise<void>
  listJobs(limit: number): Promise<ServerPluginJobRow[]>
  findJob(jobId: string): Promise<ServerPluginJobRow | null>
  saveJob(row: ServerPluginJobRow): Promise<void>
  listAudit(limit: number): Promise<ServerPluginAuditRow[]>
  saveAudit(row: ServerPluginAuditRow): Promise<void>
}