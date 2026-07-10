export const SERVER_PLUGIN_API_VERSION = 1 as const

export type ServerPluginConfigValue = boolean | number | string | null
export type ServerPluginConfig = Record<string, ServerPluginConfigValue>

export interface ServerPluginConfigChoice {
  label: string
  value: ServerPluginConfigValue
}

export interface ServerPluginConfigField {
  type: 'boolean' | 'number' | 'string'
  label: string
  description?: string
  required?: boolean
  secret?: boolean
  defaultValue?: ServerPluginConfigValue
  choices?: readonly ServerPluginConfigChoice[]
  maximum?: number
  maxLength?: number
  minimum?: number
  minLength?: number
}

export interface ServerPluginConfigSchema {
  properties: Readonly<Record<string, ServerPluginConfigField>>
  additionalProperties?: boolean
}

export interface ServerPluginDependency {
  id: string
  versionRange?: string
}

export interface ServerPluginManifest {
  apiVersion: typeof SERVER_PLUGIN_API_VERSION
  id: string
  name: string
  version: string
  author: string
  description: string
  dependencies: readonly ServerPluginDependency[]
  capabilities: readonly string[]
  configSchema: ServerPluginConfigSchema
}

export interface ServerPluginHealth {
  status: 'degraded' | 'healthy' | 'unavailable'
  message: string
  observedAt: number
  details?: Record<string, ServerPluginConfigValue>
}

export type ServerPluginHostMetric =
  | 'auth.activeSessions'
  | 'sync.changeCount'
  | 'sync.cursorBacklog'

export interface ServerPluginHost {
  probeDatabase(): Promise<boolean>
  readMetric(metric: ServerPluginHostMetric): Promise<number>
}

export interface ServerPluginRuntimeContext {
  config: Readonly<ServerPluginConfig>
  host: ServerPluginHost
  pluginId: string
  version: string
}

export interface ServerPluginRuntime {
  install?(context: ServerPluginRuntimeContext): Promise<void> | void
  update?(context: ServerPluginRuntimeContext, previousVersion: string): Promise<void> | void
  start?(context: ServerPluginRuntimeContext): Promise<void> | void
  stop?(context: ServerPluginRuntimeContext): Promise<void> | void
  uninstall?(context: ServerPluginRuntimeContext): Promise<void> | void
  health?(context: ServerPluginRuntimeContext): Promise<ServerPluginHealth> | ServerPluginHealth
}

export interface ServerPluginDefinition {
  manifest: ServerPluginManifest
  runtime: ServerPluginRuntime
}

export const defineServerPlugin = <const Definition extends ServerPluginDefinition>(
  definition: Definition,
): Definition => definition

export type ServerPluginDesiredState = 'disabled' | 'enabled' | 'uninstalled'

export type ServerPluginObservedState =
  | 'available'
  | 'disabled'
  | 'enabled'
  | 'failed'
  | 'installed'
  | 'registered'

export type ServerPluginAction =
  | 'configure'
  | 'disable'
  | 'enable'
  | 'health'
  | 'install'
  | 'register'
  | 'uninstall'
  | 'update'

export type ServerPluginJobStatus = 'failed' | 'queued' | 'running' | 'succeeded'

export interface ServerPluginJob {
  id: string
  pluginId: string
  action: ServerPluginAction
  status: ServerPluginJobStatus
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
  errorMessage?: string
  result?: Record<string, unknown>
}

export interface ServerPluginAuditEvent {
  id: string
  pluginId: string
  jobId: string
  action: ServerPluginAction
  outcome: 'failed' | 'succeeded'
  actorId: string
  createdAt: number
  detail?: Record<string, unknown>
}

export interface ServerPluginDependencyIssue {
  actualVersion?: string
  dependencyId: string
  pluginId: string
  reason: 'incompatible' | 'missing'
  versionRange?: string
}

export interface ServerPluginLoadPlan {
  levels: string[][]
  missing: ServerPluginDependencyIssue[]
  cycles: string[][]
}

export interface ServerPluginSnapshotEntry {
  manifest: ServerPluginManifest
  registered: boolean
  desiredState: ServerPluginDesiredState
  observedState: ServerPluginObservedState
  allowedActions: ServerPluginAction[]
  updateAvailable: boolean
  installedVersion?: string
  lastError?: string
  lastHealth?: ServerPluginHealth
  config: ServerPluginConfig
}

export interface ServerPluginSnapshot {
  plugins: ServerPluginSnapshotEntry[]
  plan: ServerPluginLoadPlan
  recentJobs: ServerPluginJob[]
  recentAudit: ServerPluginAuditEvent[]
  observedAt: number
}