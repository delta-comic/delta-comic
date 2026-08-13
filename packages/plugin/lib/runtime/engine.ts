import { markRaw, ref, shallowReactive, type App, type Raw, type Ref } from 'vue'

import type { ConfigEnv, DCPluginConfig } from '../api'
import {
  ActivationPipeline,
  planPluginDependencies,
  PluginScope,
  type CapabilityModule,
  type LoadedPluginModule,
  type PluginCandidate,
  type PluginCandidateProvider,
} from '../kernel'

import { PluginStore } from './store'

export interface PluginLoadingInfo {
  progress: {
    errorReason?: string
    status: 'done' | 'error' | 'process' | 'wait'
    stepsIndex: number
  }
  steps: { description: string; name: string }[]
}

export interface PluginRuntimeFailure {
  readonly error: unknown
  readonly phase: 'normal' | 'preload'
  readonly plugin: string
}

export interface PluginRuntimeReport {
  readonly activated: string[]
  readonly failures: PluginRuntimeFailure[]
}

export interface PluginRuntimeOperation {
  readonly operation: Promise<PluginRuntimeReport>
  readonly progress: Ref<Record<string, PluginLoadingInfo>>
}

export interface LoadNormalOptions {
  readonly pluginNames?: readonly string[]
}

export interface PluginPreloadRecovery {
  failedAt: number
  plugins: string[]
  reason: string
}

export interface PluginRuntimeOptions {
  readonly capabilities: () => readonly CapabilityModule[]
  readonly environment: () => ConfigEnv
  readonly provider: PluginCandidateProvider
  readonly remove: (plugin: string) => Promise<void>
  readonly store?: PluginStore
}

interface PreparedPlugin {
  readonly candidate: PluginCandidate
  readonly config: Raw<DCPluginConfig>
  readonly module: LoadedPluginModule
  readonly scope: PluginScope
}

const recoveryKey = 'delta-comic:plugin-preload-recovery:v1'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const loadingInfo = (): PluginLoadingInfo => ({
  progress: { status: 'wait', stepsIndex: 0 },
  steps: [{ description: '', name: 'waiting' }],
})

export class PluginRuntime {
  readonly #activeNormal = new Map<string, PluginScope>()
  readonly #options: PluginRuntimeOptions
  readonly #prepared = new Map<string, PreparedPlugin>()
  #normalOperation?: Promise<PluginRuntimeReport>
  #preloadOperation?: Promise<PluginRuntimeReport>
  #preloadReport?: PluginRuntimeReport

  public readonly restartRequired = shallowReactive(new Set<string>())
  public readonly store: PluginStore

  public constructor(options: PluginRuntimeOptions) {
    this.#options = options
    this.store = options.store ?? new PluginStore()
  }

  public get activeNormalPluginNames() {
    return [...this.#activeNormal.keys()]
  }

  public async preload(app: App) {
    if (this.#preloadReport) return this.#preloadReport
    if (this.#preloadOperation) return await this.#preloadOperation
    const operation = this.#prepareEnabledPlugins(app)
    this.#preloadOperation = operation
    try {
      const report = await operation
      this.#preloadReport = report
      if (report.failures.length > 0) this.#writeRecovery(report.failures)
      else this.clearRecovery()
      return report
    } finally {
      this.#preloadOperation = undefined
    }
  }

  public loadNormal(options: LoadNormalOptions = {}): PluginRuntimeOperation {
    if (!this.#preloadReport) throw new Error('plugins must be preloaded before normal activation')
    if (this.#normalOperation) throw new Error('plugin normal parts are already loading')
    if (this.activeNormalPluginNames.length > 0) {
      throw new Error('plugin normal parts are already active; use reloadNormal()')
    }
    const progress = ref<Record<string, PluginLoadingInfo>>({})
    const operation = this.#loadNormal(progress, options.pluginNames)
    this.#track(operation)
    return { operation, progress }
  }

  public reloadNormal(options: LoadNormalOptions = {}): PluginRuntimeOperation {
    if (!this.#preloadReport) throw new Error('plugins must be preloaded before normal activation')
    if (this.#normalOperation) throw new Error('plugin normal parts are already loading')
    const progress = ref<Record<string, PluginLoadingInfo>>({})
    const operation = (async () => {
      await this.#unloadNormal()
      return await this.#loadNormal(progress, options.pluginNames)
    })()
    this.#track(operation)
    return { operation, progress }
  }

  public markRestartRequired(plugin: string) {
    this.restartRequired.add(plugin)
  }

  public async uninstall(plugin: string) {
    const candidate = this.store.candidates.get(plugin)
    if (!candidate) throw new Error(`plugin "${plugin}" is not a known candidate`)
    if (!candidate.management.canUninstall) {
      throw new Error(`plugin "${plugin}" cannot be uninstalled`)
    }

    const active = this.#activeNormal.get(plugin)
    if (active) await this.#deactivateNormal(plugin, active)
    const prepared = this.#prepared.get(plugin)
    if (prepared) {
      this.#prepared.delete(plugin)
      await prepared.scope.dispose()
    } else {
      await this.#runUninstallHook(candidate)
    }
    this.restartRequired.delete(plugin)
    await this.#options.remove(plugin)
    await this.refreshCandidates()
  }

  public async refreshCandidates() {
    const candidates = await this.#options.provider.list(new AbortController().signal)
    this.store.replaceCandidates(candidates)
    return candidates
  }

  public readRecovery(): PluginPreloadRecovery | null {
    try {
      const value = globalThis.localStorage?.getItem(recoveryKey)
      return value ? (JSON.parse(value) as PluginPreloadRecovery) : null
    } catch {
      return null
    }
  }

  public clearRecovery() {
    try {
      globalThis.localStorage?.removeItem(recoveryKey)
    } catch {}
  }

  async #prepareEnabledPlugins(app: App): Promise<PluginRuntimeReport> {
    const candidates = (await this.refreshCandidates()).filter(candidate => candidate.enabled)
    const plan = planPluginDependencies(candidates)

    const activated: string[] = []
    const failures: PluginRuntimeFailure[] = plan.missing.map(({ dependency, plugin }) => ({
      error: new Error(`missing dependency: ${dependency}`),
      phase: 'preload',
      plugin,
    }))
    for (const cycle of plan.cycles) {
      const error = new Error(`dependency cycle: ${cycle.join(' -> ')}`)
      for (const plugin of cycle.slice(0, -1)) failures.push({ error, phase: 'preload', plugin })
    }
    const failed = new Set(failures.map(value => value.plugin))
    for (const level of plan.levels) {
      for (const candidate of level) {
        const plugin = candidate.manifest.name.id
        if (failed.has(plugin)) continue
        const blockedBy = candidate.manifest.require
          .map(value => value.id)
          .filter(dependency => failed.has(dependency))
        if (blockedBy.length > 0) {
          failures.push({
            error: new Error(`dependency preload failed: ${blockedBy.join(', ')}`),
            phase: 'preload',
            plugin,
          })
          failed.add(plugin)
          continue
        }

        const scope = new PluginScope(plugin)
        try {
          const { config, module } = await this.#loadPlugin(candidate, scope)
          const cleanup = await config.hooks?.onPreboot?.({ app })
          if (cleanup) scope.defer(cleanup)
          this.#prepared.set(plugin, { candidate, config, module, scope })
          activated.push(plugin)
        } catch (error) {
          failures.push({ error, phase: 'preload', plugin })
          failed.add(plugin)
          await scope.dispose(error).catch(disposeError => {
            failures.push({ error: disposeError, phase: 'preload', plugin })
          })
        }
      }
    }
    return { activated, failures }
  }

  async #loadNormal(
    progress: Ref<Record<string, PluginLoadingInfo>>,
    selected?: readonly string[],
  ): Promise<PluginRuntimeReport> {
    const candidates = [...this.#prepared.values()].map(value => value.candidate)
    const mandatory = candidates
      .filter(candidate => !candidate.management.canDisable)
      .map(candidate => candidate.manifest.name.id)
    const chosen = selected
      ? this.#selectWithDependencies(candidates, [...mandatory, ...selected])
      : candidates
    const plan = planPluginDependencies(chosen)
    this.#assertValidPlan(plan)

    const activated: string[] = []
    const failures: PluginRuntimeFailure[] = []
    const failed = new Set<string>()
    for (const level of plan.levels) {
      for (const candidate of level) {
        const plugin = candidate.manifest.name.id
        const info = (progress.value[plugin] = loadingInfo())
        const blockedBy = candidate.manifest.require
          .map(value => value.id)
          .filter(dependency => failed.has(dependency))
        if (blockedBy.length > 0) {
          const error = new Error(`dependency activation failed: ${blockedBy.join(', ')}`)
          info.progress = { errorReason: error.message, status: 'error', stepsIndex: 0 }
          failures.push({ error, phase: 'normal', plugin })
          failed.add(plugin)
          continue
        }

        const prepared = this.#prepared.get(plugin)
        if (!prepared) continue
        const scope = new PluginScope(plugin)
        try {
          info.progress.status = 'process'
          await prepared.module.activate?.(scope)
          this.store.markLoading(plugin, prepared.config)
          scope.defer(() => this.store.markUnloaded(plugin))
          await new ActivationPipeline(this.#options.capabilities()).activate(prepared.config, {
            owner: plugin,
            report: update => {
              const value = typeof update === 'string' ? { description: update } : update
              info.steps[0] = { ...info.steps[0], ...value }
            },
            scope,
            signal: scope.signal,
          })
          this.#activeNormal.set(plugin, scope)
          this.store.markReady(plugin)
          info.progress.status = 'done'
          activated.push(plugin)
        } catch (error) {
          info.progress = { errorReason: errorText(error), status: 'error', stepsIndex: 0 }
          failures.push({ error, phase: 'normal', plugin })
          failed.add(plugin)
          await scope.dispose(error).catch(disposeError => {
            failures.push({ error: disposeError, phase: 'normal', plugin })
          })
        }
      }
    }
    return { activated, failures }
  }

  async #loadPlugin(candidate: PluginCandidate, scope: PluginScope) {
    const plugin = candidate.manifest.name.id
    const loaded: LoadedPluginModule = await candidate.load(scope.signal)
    if (loaded.dispose) scope.defer(loaded.dispose)
    const config = markRaw(loaded.factory(this.#options.environment()))
    if (config.name !== plugin) throw new Error(`plugin name mismatch: ${plugin} / ${config.name}`)
    return { config, module: loaded }
  }

  async #runUninstallHook(candidate: PluginCandidate) {
    const plugin = candidate.manifest.name.id
    const scope = new PluginScope(plugin)
    try {
      const { config } = await this.#loadPlugin(candidate, scope)
      await config.hooks?.onUninstall?.()
    } finally {
      await scope.dispose()
    }
  }

  #assertValidPlan(plan: ReturnType<typeof planPluginDependencies>) {
    if (plan.missing.length === 0 && plan.cycles.length === 0) return
    const missing = plan.missing.map(value => `${value.plugin} -> ${value.dependency}`).join(', ')
    const cycles = plan.cycles.map(value => value.join(' -> ')).join(', ')
    throw new Error(
      [missing && `missing: ${missing}`, cycles && `cycles: ${cycles}`].filter(Boolean).join('; '),
    )
  }

  #selectWithDependencies(candidates: readonly PluginCandidate[], selected: readonly string[]) {
    const byId = new Map(candidates.map(candidate => [candidate.manifest.name.id, candidate]))
    const result = new Map<string, PluginCandidate>()
    const visit = (plugin: string) => {
      const candidate = byId.get(plugin)
      if (!candidate || result.has(plugin)) return
      for (const dependency of candidate.manifest.require) visit(dependency.id)
      result.set(plugin, candidate)
    }
    for (const plugin of selected) visit(plugin)
    return [...result.values()]
  }

  #track(operation: Promise<PluginRuntimeReport>) {
    this.#normalOperation = operation
    void operation.then(
      () => (this.#normalOperation = undefined),
      () => (this.#normalOperation = undefined),
    )
  }

  async #unloadNormal() {
    const targets = [...this.#activeNormal].reverse()
    const errors: unknown[] = []
    for (const [plugin, scope] of targets) {
      try {
        await this.#deactivateNormal(plugin, scope)
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'some plugins failed to unload')
  }

  async #deactivateNormal(plugin: string, scope: PluginScope) {
    this.#activeNormal.delete(plugin)
    await scope.dispose()
  }

  #writeRecovery(failures: readonly PluginRuntimeFailure[]) {
    try {
      globalThis.localStorage?.setItem(
        recoveryKey,
        JSON.stringify({
          failedAt: Date.now(),
          plugins: failures.map(value => value.plugin),
          reason: failures.map(value => errorText(value.error)).join('\n'),
        } satisfies PluginPreloadRecovery),
      )
    } catch {}
  }
}