import type { PluginArchiveDB } from '@delta-comic/platform/db'

import type {
  PluginFileReplacement,
  PluginArchiveRepository,
  PluginFileStore,
  PluginInstallInput,
  PluginInstallReporter,
  PluginPackageCodec,
  PluginSourceResolver,
} from './contracts'
import { DEV_SERVER_LOADER_ID } from './dev'
import { manifestRevision, revisionKey } from './revision'

export interface PluginInstallServiceOptions {
  readonly codecs: readonly PluginPackageCodec[]
  readonly files: PluginFileStore
  readonly repository: PluginArchiveRepository
  readonly reservedIds?: ReadonlySet<string>
  readonly resolvers: readonly PluginSourceResolver[]
}

export interface PluginInstallHooks {
  readonly expectedId?: string
  readonly afterStage?: (
    archive: PluginArchiveDB.Archive,
    previous: PluginArchiveDB.Archive | undefined,
  ) => void | PluginFileReplacement | Promise<void | PluginFileReplacement>
}

export class PluginInstallService {
  public constructor(private readonly options: PluginInstallServiceOptions) {}

  public get inputPrefixes(): readonly string[] {
    return [...new Set(this.options.resolvers.flatMap(resolver => resolver.inputPrefixes ?? []))]
  }

  private findResolver(input: PluginInstallInput) {
    return this.options.resolvers.find(source => source.matches(input))
  }

  public isValidInput(input: PluginInstallInput): boolean {
    return this.findResolver(input) !== undefined
  }

  public async install(
    input: PluginInstallInput,
    signal = new AbortController().signal,
    report: PluginInstallReporter = () => {},
    hooks: PluginInstallHooks = {},
  ) {
    report({ phase: 'resolve', progress: 0 })
    const resolver = this.findResolver(input)
    if (!resolver) throw new Error('no plugin source resolver accepts this input')
    const source = await resolver.resolve(input, signal, report)
    signal.throwIfAborted()
    report({
      phase: 'resolve',
      progress: 100,
      description: source.kind === 'archive' ? source.file.name : source.installInput,
    })
    const resolved =
      source.kind === 'archive'
        ? await this.decode(source.file, signal, report)
        : { manifest: source.manifest, codecId: DEV_SERVER_LOADER_ID, files: source.files }
    const { manifest, files, codecId } = resolved
    const plugin = manifest.id

    if (this.options.reservedIds?.has(plugin)) throw new Error(`plugin id is reserved: ${plugin}`)
    if (hooks.expectedId !== undefined && hooks.expectedId !== plugin)
      throw new Error(`expected plugin ${hooks.expectedId}, received ${plugin}`)
    signal.throwIfAborted()
    report({ phase: 'decode', progress: 100, description: plugin })
    const previous = await this.options.repository.find(plugin)
    const manifestBytes = files.get('manifest.json')
    if (!manifestBytes) throw new Error('missing manifest bytes')
    const revision = await manifestRevision(manifestBytes)
    const key = revisionKey(plugin, revision)
    for (const row of await this.options.repository.list()) {
      if (
        row.pluginName !== plugin &&
        (row.pluginName.toLowerCase() === plugin || row.meta?.package === manifest.package)
      )
        throw new Error(`installation conflicts with ${row.pluginName}: ${manifest.package}`)
    }
    if (previous?.revision && previous.meta.package !== manifest.package)
      throw new Error(`package changed for ${plugin}`)
    const replacement =
      previous?.revision === revision ? undefined : await this.options.files.replace(key, files)
    let activation: PluginFileReplacement | void = undefined
    const archive: PluginArchiveDB.Archive = {
      revision,
      displayName: manifest.name,
      enable: previous?.enable ?? true,
      config: previous?.config ?? {},
      installerName: source.resolverId,
      installInput: source.installInput,
      loaderName: codecId,
      meta: manifest,
      pluginName: plugin,
    }
    try {
      signal.throwIfAborted()
      report({ phase: 'persist', progress: 50, description: plugin })
      activation = await hooks.afterStage?.(archive, previous)
      signal.throwIfAborted()
      await this.options.repository.upsert(archive)
      await replacement?.commit()
      await activation?.commit()
      report({ phase: 'persist', progress: 100, description: plugin })
      return archive
    } catch (error) {
      const errors: unknown[] = [error]
      try {
        await replacement?.rollback()
      } catch (error) {
        errors.push(error)
      }
      try {
        if (previous) await this.options.repository.upsert(previous)
        else await this.options.repository.remove(plugin)
      } catch (error) {
        errors.push(error)
      }
      try {
        await activation?.rollback()
      } catch (error) {
        errors.push(error)
      }
      if (errors.length > 1)
        throw new AggregateError(errors, `plugin install rollback failed: ${plugin}`)
      throw error
    }
  }

  private async decode(file: File, signal: AbortSignal, report: PluginInstallReporter) {
    const codec = this.options.codecs.find(codec => codec.matches(file))
    if (!codec) throw new Error('no plugin package codec accepts this file')
    report({ phase: 'decode', progress: 0, description: codec.id })
    return await codec.decode(file, signal)
  }

  public async uninstall(plugin: string) {
    const previous = await this.options.repository.find(plugin)
    if (!previous) return
    await this.options.repository.remove(plugin)
    await this.options.files.remove(
      previous.revision ? revisionKey(plugin, previous.revision) : plugin,
    )
  }
}