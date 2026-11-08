import type { PluginArchiveDB } from '@delta-comic/db'

import type {
  DecodedPluginPackage,
  PluginArchiveRepository,
  PluginFileStore,
  PluginInstallInput,
  PluginInstallReporter,
  PluginPackageCodec,
  PluginSourceResolver,
} from './contracts'

export interface PluginInstallServiceOptions {
  readonly codecs: readonly PluginPackageCodec[]
  readonly files: PluginFileStore
  readonly repository: PluginArchiveRepository
  readonly reservedIds?: ReadonlySet<string>
  readonly resolvers: readonly PluginSourceResolver[]
}

export interface PluginInstallHooks {
  readonly afterStage?: (
    archive: PluginArchiveDB.Archive,
    previous: PluginArchiveDB.Archive | undefined,
  ) => void | Promise<void>
}

export class PluginInstallService {
  public constructor(private readonly options: PluginInstallServiceOptions) {}

  public async install(
    input: PluginInstallInput,
    signal = new AbortController().signal,
    report: PluginInstallReporter = () => {},
    hooks: PluginInstallHooks = {},
  ) {
    report({ phase: 'resolve', progress: 0 })
    const resolver = this.options.resolvers.find(source => source.matches(input))
    if (!resolver) throw new Error('no plugin source resolver accepts this input')
    const source = await resolver.resolve(input, signal, report)
    signal.throwIfAborted()
    report({
      phase: 'resolve',
      progress: 100,
      description: source.file?.name ?? source.installInput,
    })
    let decoded: DecodedPluginPackage
    if (source.package) decoded = source.package
    else {
      const file = source.file
      if (!file) throw new Error('resolved plugin source contains neither a file nor a package')
      const codec = this.options.codecs.find(codec => codec.matches(file))
      if (!codec) throw new Error('no plugin package codec accepts this file')
      report({ phase: 'decode', progress: 0, description: codec.id })
      decoded = await codec.decode(file, signal)
    }
    const plugin = decoded.manifest.id
    if (!decoded.manifest.client) throw new Error(`plugin has no client entry: ${plugin}`)
    if (this.options.reservedIds?.has(plugin)) throw new Error(`plugin id is reserved: ${plugin}`)
    signal.throwIfAborted()
    report({ phase: 'decode', progress: 100, description: plugin })
    const previous = await this.options.repository.find(plugin)
    const replacement = await this.options.files.replace(
      plugin,
      source.storage === 'remote' ? new Map() : decoded.files,
    )
    const archive: PluginArchiveDB.Archive = {
      displayName: decoded.manifest.name,
      enable: previous?.enable ?? true,
      config: previous?.config ?? {},
      installerName: source.resolverId,
      installInput: source.installInput,
      loaderName: decoded.codecId,
      meta: decoded.manifest,
      pluginName: plugin,
    }
    try {
      signal.throwIfAborted()
      report({ phase: 'persist', progress: 50, description: plugin })
      await this.options.repository.upsert(archive)
      await hooks.afterStage?.(archive, previous)
      await replacement.commit()
      report({ phase: 'persist', progress: 100, description: plugin })
      return archive
    } catch (error) {
      const errors: unknown[] = [error]
      try {
        await replacement.rollback()
      } catch (error) {
        errors.push(error)
      }
      try {
        if (previous) await this.options.repository.upsert(previous)
        else await this.options.repository.remove(plugin)
      } catch (error) {
        errors.push(error)
      }
      if (errors.length > 1)
        throw new AggregateError(errors, `plugin install rollback failed: ${plugin}`)
      throw error
    }
  }

  public async uninstall(plugin: string) {
    const previous = await this.options.repository.find(plugin)
    const replacement = await this.options.files.replace(plugin, new Map())
    try {
      await this.options.repository.remove(plugin)
      await replacement.commit()
    } catch (error) {
      const errors: unknown[] = [error]
      try {
        await replacement.rollback()
      } catch (error) {
        errors.push(error)
      }
      try {
        if (previous) await this.options.repository.upsert(previous)
      } catch (error) {
        errors.push(error)
      }
      if (errors.length > 1)
        throw new AggregateError(errors, `plugin uninstall rollback failed: ${plugin}`)
      throw error
    }
  }
}