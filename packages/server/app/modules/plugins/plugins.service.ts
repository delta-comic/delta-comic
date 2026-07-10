import { satisfies as versionSatisfies } from 'semver'

import { AppError } from '@/shared/errors'

import type {
  ServerPluginAction,
  ServerPluginAuditEvent,
  ServerPluginConfig,
  ServerPluginDefinition,
  ServerPluginHealth,
  ServerPluginJob,
  ServerPluginManifest,
  ServerPluginSnapshot,
  ServerPluginSnapshotEntry,
} from '../../../lib/plugin'

import { StaticPluginExecutor, type ServerPluginExecutor } from './plugins.executor'
import { D1ServerPluginHost } from './plugins.host'
import { normalizeServerPluginConfig, validateServerPluginManifest } from './plugins.manifest'
import { findServerPluginDependents, planServerPluginLoadOrder } from './plugins.plan'
import { ServerPluginRepository } from './plugins.repository'
import type {
  ServerPluginAuditRow,
  ServerPluginInstallationRow,
  ServerPluginJobRow,
  ServerPluginRegistryRow,
  ServerPluginRepositoryContract,
} from './plugins.types'

type JobResult = Record<string, unknown>

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const toJob = (row: ServerPluginJobRow): ServerPluginJob => ({
  action: row.action,
  ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
  createdAt: row.created_at,
  ...(row.error_message ? { errorMessage: row.error_message } : {}),
  id: row.id,
  pluginId: row.plugin_id,
  ...(row.result_json ? { result: parseJson<JobResult>(row.result_json, {}) } : {}),
  ...(row.started_at === null ? {} : { startedAt: row.started_at }),
  status: row.status,
  updatedAt: row.updated_at,
})

const toAudit = (row: ServerPluginAuditRow): ServerPluginAuditEvent => ({
  action: row.action,
  actorId: row.actor_id,
  createdAt: row.created_at,
  ...(row.detail_json ? { detail: parseJson<JobResult>(row.detail_json, {}) } : {}),
  id: row.id,
  jobId: row.job_id,
  outcome: row.outcome,
  pluginId: row.plugin_id,
})

const defaultInstallation = (
  definition: ServerPluginDefinition,
  config: ServerPluginConfig,
  now: number,
): ServerPluginInstallationRow => ({
  config_json: JSON.stringify(config),
  desired_state: 'disabled',
  installed_at: now,
  installed_version: definition.manifest.version,
  last_error: null,
  last_health_at: null,
  last_health_json: null,
  observed_state: 'installed',
  plugin_id: definition.manifest.id,
  updated_at: now,
})

export class ServerPluginService {
  constructor(
    private readonly repository: ServerPluginRepositoryContract,
    private readonly executor: ServerPluginExecutor,
    private readonly now: () => number = Date.now,
    private readonly randomId: () => string = () => crypto.randomUUID(),
  ) {}

  async snapshot(): Promise<ServerPluginSnapshot> {
    const definitions = this.executor.listDefinitions()
    const [registryRows, installationRows, recentJobs, recentAudit] = await Promise.all([
      this.repository.listRegistry(),
      this.repository.listInstallations(),
      this.repository.listJobs(30),
      this.repository.listAudit(50),
    ])
    const registry = new Map(registryRows.map(row => [row.plugin_id, row]))
    const installations = new Map(installationRows.map(row => [row.plugin_id, row]))
    const definitionsById = new Map(
      definitions.map(definition => [definition.manifest.id, definition]),
    )

    const entries = definitions.map(definition =>
      this.toSnapshotEntry(
        definition.manifest,
        true,
        registry.get(definition.manifest.id),
        installations.get(definition.manifest.id),
      ),
    )

    for (const row of registryRows) {
      if (definitionsById.has(row.plugin_id)) continue
      const manifest = this.readManifest(row)
      entries.push(this.toSnapshotEntry(manifest, false, row, installations.get(row.plugin_id)))
    }

    return {
      observedAt: this.now(),
      plan: planServerPluginLoadOrder(definitions.map(definition => definition.manifest)),
      plugins: entries.sort((left, right) => left.manifest.id.localeCompare(right.manifest.id)),
      recentAudit: recentAudit.map(toAudit),
      recentJobs: recentJobs.map(toJob),
    }
  }

  async findJob(jobId: string): Promise<ServerPluginJob> {
    const row = await this.repository.findJob(jobId)
    if (!row) throw new AppError('PLUGIN_JOB_NOT_FOUND', 'plugin job was not found', 404)
    return toJob(row)
  }

  register(pluginId: string, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'register', actorId, false, async () => {
      const definition = this.requireDefinition(pluginId)
      await this.saveRegistry(definition.manifest)
      return { version: definition.manifest.version }
    })
  }

  install(pluginId: string, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'install', actorId, true, async () => {
      const ordered = this.resolveDependencyOrder(pluginId)
      for (const definition of ordered) await this.installDefinition(definition)
      return { installed: ordered.map(definition => definition.manifest.id) }
    })
  }

  enable(pluginId: string, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'enable', actorId, true, async () => {
      const ordered = this.resolveDependencyOrder(pluginId)
      for (const definition of ordered) {
        let installation = await this.repository.findInstallation(definition.manifest.id)
        if (!installation) {
          await this.installDefinition(definition)
          installation = await this.repository.findInstallation(definition.manifest.id)
        }
        if (!installation) {
          throw new AppError('PLUGIN_INSTALL_FAILED', 'plugin installation was not persisted', 500)
        }
        if (installation.observed_state === 'enabled') continue
        const config = this.readConfig(installation)
        await this.executor.start(definition.manifest.id, config)
        await this.repository.saveInstallation({
          ...installation,
          desired_state: 'enabled',
          last_error: null,
          observed_state: 'enabled',
          updated_at: this.now(),
        })
      }
      return { enabled: ordered.map(definition => definition.manifest.id) }
    })
  }

  disable(pluginId: string, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'disable', actorId, true, async () => {
      await this.assertNoEnabledDependents(pluginId)
      const installation = await this.requireInstallation(pluginId)
      if (installation.observed_state !== 'enabled') {
        await this.repository.saveInstallation({
          ...installation,
          desired_state: 'disabled',
          observed_state: 'disabled',
          updated_at: this.now(),
        })
        return { disabled: pluginId }
      }
      await this.executor.stop(pluginId, this.readConfig(installation))
      await this.repository.saveInstallation({
        ...installation,
        desired_state: 'disabled',
        last_error: null,
        observed_state: 'disabled',
        updated_at: this.now(),
      })
      return { disabled: pluginId }
    })
  }

  update(pluginId: string, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'update', actorId, true, async () => {
      const definition = this.requireDefinition(pluginId)
      const installation = await this.requireInstallation(pluginId)
      if (installation.installed_version === definition.manifest.version) {
        return { changed: false, version: installation.installed_version }
      }
      const config = normalizeServerPluginConfig(
        definition.manifest,
        {},
        this.readConfig(installation),
      )
      const wasEnabled = installation.observed_state === 'enabled'
      if (wasEnabled) await this.executor.stop(pluginId, config)
      await this.executor.update(pluginId, installation.installed_version, config)
      if (wasEnabled) await this.executor.start(pluginId, config)
      await this.saveRegistry(definition.manifest)
      await this.repository.saveInstallation({
        ...installation,
        config_json: JSON.stringify(config),
        installed_version: definition.manifest.version,
        last_error: null,
        observed_state: wasEnabled ? 'enabled' : 'disabled',
        updated_at: this.now(),
      })
      return {
        changed: true,
        previousVersion: installation.installed_version,
        version: definition.manifest.version,
      }
    })
  }

  configure(pluginId: string, configPatch: unknown, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'configure', actorId, false, async () => {
      const definition = this.requireDefinition(pluginId)
      const installation = await this.requireInstallation(pluginId)
      const current = this.readConfig(installation)
      const config = normalizeServerPluginConfig(definition.manifest, configPatch, current)
      const wasEnabled = installation.observed_state === 'enabled'
      if (wasEnabled) {
        await this.executor.stop(pluginId, current)
        try {
          await this.executor.start(pluginId, config)
        } catch (error) {
          await this.executor.start(pluginId, current).catch(() => undefined)
          throw error
        }
      }
      await this.repository.saveInstallation({
        ...installation,
        config_json: JSON.stringify(config),
        last_error: null,
        updated_at: this.now(),
      })
      return { configured: Object.keys(config).sort() }
    })
  }

  health(pluginId: string, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'health', actorId, false, async () => {
      const installation = await this.requireInstallation(pluginId)
      try {
        const health = await this.executor.health(pluginId, this.readConfig(installation))
        await this.repository.saveInstallation({
          ...installation,
          last_error: health.status === 'unavailable' ? health.message : null,
          last_health_at: health.observedAt,
          last_health_json: JSON.stringify(health),
          updated_at: this.now(),
        })
        return { health }
      } catch (error) {
        const observedAt = this.now()
        const health: ServerPluginHealth = {
          message: errorMessage(error),
          observedAt,
          status: 'unavailable',
        }
        await this.repository.saveInstallation({
          ...installation,
          last_error: health.message,
          last_health_at: observedAt,
          last_health_json: JSON.stringify(health),
          updated_at: observedAt,
        })
        throw error
      }
    })
  }

  uninstall(pluginId: string, actorId: string): Promise<ServerPluginJob> {
    return this.runJob(pluginId, 'uninstall', actorId, true, async () => {
      await this.assertNoInstalledDependents(pluginId)
      const installation = await this.requireInstallation(pluginId)
      const definition = this.executor.getDefinition(pluginId)
      if (definition) {
        const config = this.readConfig(installation)
        if (installation.observed_state === 'enabled') await this.executor.stop(pluginId, config)
        await this.executor.uninstall(pluginId, config)
      }
      await this.repository.removeInstallation(pluginId)
      await this.repository.removeRegistry(pluginId)
      return { uninstalled: pluginId }
    })
  }

  private async runJob(
    pluginId: string,
    action: ServerPluginAction,
    actorId: string,
    markRuntimeFailure: boolean,
    operation: () => Promise<JobResult>,
  ): Promise<ServerPluginJob> {
    const createdAt = this.now()
    let row: ServerPluginJobRow = {
      action,
      completed_at: null,
      created_at: createdAt,
      error_message: null,
      id: this.randomId(),
      plugin_id: pluginId,
      result_json: null,
      started_at: null,
      status: 'queued',
      updated_at: createdAt,
    }
    await this.repository.saveJob(row)
    row = { ...row, started_at: this.now(), status: 'running', updated_at: this.now() }
    await this.repository.saveJob(row)

    try {
      const result = await operation()
      const completedAt = this.now()
      row = {
        ...row,
        completed_at: completedAt,
        result_json: JSON.stringify(result),
        status: 'succeeded',
        updated_at: completedAt,
      }
      await this.repository.saveJob(row)
      await this.saveAudit(row, actorId, 'succeeded', result)
      return toJob(row)
    } catch (error) {
      const completedAt = this.now()
      const message = errorMessage(error)
      row = {
        ...row,
        completed_at: completedAt,
        error_message: message,
        status: 'failed',
        updated_at: completedAt,
      }
      await this.repository.saveJob(row)
      const isRejectedOperation = error instanceof AppError && error.status < 500
      if (markRuntimeFailure && !isRejectedOperation) {
        await this.markInstallationFailed(pluginId, message)
      }
      await this.saveAudit(row, actorId, 'failed', { error: message })
      return toJob(row)
    }
  }

  private async saveAudit(
    job: ServerPluginJobRow,
    actorId: string,
    outcome: ServerPluginAuditRow['outcome'],
    detail: JobResult,
  ): Promise<void> {
    await this.repository.saveAudit({
      action: job.action,
      actor_id: actorId,
      created_at: this.now(),
      detail_json: JSON.stringify(detail),
      id: this.randomId(),
      job_id: job.id,
      outcome,
      plugin_id: job.plugin_id,
    })
  }

  private async markInstallationFailed(pluginId: string, message: string): Promise<void> {
    const installation = await this.repository.findInstallation(pluginId)
    if (!installation) return
    await this.repository.saveInstallation({
      ...installation,
      last_error: message,
      observed_state: 'failed',
      updated_at: this.now(),
    })
  }

  private requireDefinition(pluginId: string): ServerPluginDefinition {
    const definition = this.executor.getDefinition(pluginId)
    if (!definition) {
      throw new AppError(
        'PLUGIN_DEFINITION_NOT_FOUND',
        `static server plugin definition not found: ${pluginId}`,
        404,
      )
    }
    return definition
  }

  private async requireInstallation(pluginId: string): Promise<ServerPluginInstallationRow> {
    const installation = await this.repository.findInstallation(pluginId)
    if (!installation) throw new AppError('PLUGIN_NOT_INSTALLED', 'plugin is not installed', 409)
    return installation
  }

  private async saveRegistry(manifest: ServerPluginManifest): Promise<void> {
    const existing = await this.repository.findRegistry(manifest.id)
    const now = this.now()
    await this.repository.saveRegistry({
      manifest_json: JSON.stringify(manifest),
      plugin_id: manifest.id,
      registered_at: existing?.registered_at ?? now,
      source: 'static',
      trusted: 1,
      updated_at: now,
    })
  }

  private async installDefinition(definition: ServerPluginDefinition): Promise<void> {
    await this.saveRegistry(definition.manifest)
    const existing = await this.repository.findInstallation(definition.manifest.id)
    if (existing) return
    const config = normalizeServerPluginConfig(definition.manifest, {})
    await this.executor.install(definition.manifest.id, config)
    await this.repository.saveInstallation(defaultInstallation(definition, config, this.now()))
  }

  private resolveDependencyOrder(pluginId: string): ServerPluginDefinition[] {
    const definitions = new Map(
      this.executor.listDefinitions().map(definition => [definition.manifest.id, definition]),
    )
    const selected = new Map<string, ServerPluginDefinition>()
    const visiting = new Set<string>()
    const visit = (id: string): void => {
      if (selected.has(id)) return
      if (visiting.has(id)) {
        throw new AppError('PLUGIN_DEPENDENCY_CYCLE', `plugin dependency cycle includes ${id}`, 409)
      }
      const definition = definitions.get(id)
      if (!definition) {
        throw new AppError(
          'PLUGIN_DEPENDENCY_MISSING',
          `required server plugin definition is missing: ${id}`,
          409,
        )
      }
      visiting.add(id)
      for (const dependency of definition.manifest.dependencies) {
        const dependencyDefinition = definitions.get(dependency.id)
        if (
          dependencyDefinition &&
          dependency.versionRange &&
          !versionSatisfies(dependencyDefinition.manifest.version, dependency.versionRange)
        ) {
          throw new AppError(
            'PLUGIN_DEPENDENCY_INCOMPATIBLE',
            `${dependency.id} ${dependencyDefinition.manifest.version} does not satisfy ${dependency.versionRange}`,
            409,
          )
        }
        visit(dependency.id)
      }
      visiting.delete(id)
      selected.set(id, definition)
    }
    visit(pluginId)
    return [...selected.values()]
  }

  private async assertNoEnabledDependents(pluginId: string): Promise<void> {
    const manifests = this.executor.listDefinitions().map(definition => definition.manifest)
    const dependents = findServerPluginDependents(pluginId, manifests)
    const blocking: string[] = []
    for (const dependentId of dependents) {
      const installation = await this.repository.findInstallation(dependentId)
      if (installation?.desired_state === 'enabled') blocking.push(dependentId)
    }
    if (blocking.length > 0) {
      throw new AppError(
        'PLUGIN_HAS_ENABLED_DEPENDENTS',
        `disable dependent plugins first: ${blocking.join(', ')}`,
        409,
      )
    }
  }

  private async assertNoInstalledDependents(pluginId: string): Promise<void> {
    const manifests = this.executor.listDefinitions().map(definition => definition.manifest)
    const dependents = findServerPluginDependents(pluginId, manifests)
    const blocking: string[] = []
    for (const dependentId of dependents) {
      if (await this.repository.findInstallation(dependentId)) blocking.push(dependentId)
    }
    if (blocking.length > 0) {
      throw new AppError(
        'PLUGIN_HAS_INSTALLED_DEPENDENTS',
        `uninstall dependent plugins first: ${blocking.join(', ')}`,
        409,
      )
    }
  }

  private readManifest(row: ServerPluginRegistryRow): ServerPluginManifest {
    return validateServerPluginManifest(parseJson<unknown>(row.manifest_json, null))
  }

  private readConfig(row: ServerPluginInstallationRow): ServerPluginConfig {
    return parseJson<ServerPluginConfig>(row.config_json, {})
  }

  private toSnapshotEntry(
    manifest: ServerPluginManifest,
    definitionAvailable: boolean,
    registry: ServerPluginRegistryRow | undefined,
    installation: ServerPluginInstallationRow | undefined,
  ): ServerPluginSnapshotEntry {
    const updateAvailable = Boolean(
      definitionAvailable && installation && installation.installed_version !== manifest.version,
    )
    const allowedActions: ServerPluginAction[] = []
    if (!registry && definitionAvailable) allowedActions.push('register')
    if (registry && !installation && definitionAvailable) allowedActions.push('install')
    if (installation) {
      allowedActions.push('configure', 'health', 'uninstall')
      if (installation.observed_state === 'enabled') allowedActions.push('disable')
      else if (definitionAvailable) allowedActions.push('enable')
      if (updateAvailable) allowedActions.push('update')
    }

    const observedState =
      !definitionAvailable && registry
        ? 'failed'
        : (installation?.observed_state ?? (registry ? 'registered' : 'available'))

    return {
      allowedActions,
      config: installation ? this.readConfig(installation) : {},
      desiredState: installation?.desired_state ?? 'uninstalled',
      ...(installation ? { installedVersion: installation.installed_version } : {}),
      ...(installation?.last_error || (!definitionAvailable && registry)
        ? { lastError: installation?.last_error ?? 'static plugin definition is unavailable' }
        : {}),
      ...(installation?.last_health_json
        ? {
            lastHealth: parseJson<ServerPluginHealth>(installation.last_health_json, {
              message: 'invalid stored health payload',
              observedAt: installation.last_health_at ?? this.now(),
              status: 'unavailable',
            }),
          }
        : {}),
      manifest,
      observedState,
      registered: Boolean(registry),
      updateAvailable,
    }
  }
}

export const createPluginService = (db: D1Database): ServerPluginService =>
  new ServerPluginService(
    new ServerPluginRepository(db),
    new StaticPluginExecutor(undefined, new D1ServerPluginHost(db)),
  )