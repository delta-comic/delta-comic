import type { PluginArchiveDB } from '@delta-comic/db'

import type {
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

export class PluginInstallService {
  public constructor(private readonly options: PluginInstallServiceOptions) {}

  public async install(
    input: PluginInstallInput,
    signal = new AbortController().signal,
    report: PluginInstallReporter = () => {},
  ) {
    report({ phase: 'resolve', progress: 0 })
    const resolver = this.options.resolvers.find(candidate => candidate.matches(input))
    if (!resolver) throw new Error('no plugin source resolver accepts this input')
    const source = await resolver.resolve(input, signal, report)
    report({ description: source.file.name, phase: 'resolve', progress: 100 })

    const codec = this.options.codecs.find(candidate => candidate.matches(source.file))
    if (!codec) throw new Error('no plugin package codec accepts this file')
    report({ description: codec.id, phase: 'decode', progress: 0 })
    const decoded = await codec.decode(source.file, signal)
    const plugin = decoded.manifest.name.id
    if (this.options.reservedIds?.has(plugin)) {
      throw new Error(`plugin id "${plugin}" is reserved by an internal plugin`)
    }
    report({ description: plugin, phase: 'decode', progress: 100 })

    const previous = await this.options.repository.find(plugin)
    const replacement = await this.options.files.replace(plugin, decoded.files)
    const archive: PluginArchiveDB.Archive = {
      displayName: decoded.manifest.name.display,
      enable: previous?.enable ?? true,
      installerName: source.resolverId,
      installInput: source.installInput,
      loaderName: decoded.codecId,
      meta: decoded.manifest,
      pluginName: plugin,
    }

    try {
      report({ description: plugin, phase: 'persist', progress: 50 })
      await this.options.repository.upsert(archive)
      await replacement.commit()
      report({ description: plugin, phase: 'persist', progress: 100 })
      return archive
    } catch (error) {
      const rollbackErrors: unknown[] = []
      try {
        await replacement.rollback()
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      try {
        if (previous) await this.options.repository.upsert(previous)
        else await this.options.repository.remove(plugin)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], `failed to install plugin "${plugin}"`)
      }
      throw error
    }
  }

  /** Remove archive metadata and files as one compensating transaction. */
  public async uninstall(plugin: string) {
    const previous = await this.options.repository.find(plugin)
    const replacement = await this.options.files.replace(plugin, new Map())
    try {
      await this.options.repository.remove(plugin)
      await replacement.commit()
    } catch (error) {
      const rollbackErrors: unknown[] = []
      try {
        await replacement.rollback()
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      try {
        if (previous) await this.options.repository.upsert(previous)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          `failed to uninstall plugin "${plugin}"`,
        )
      }
      throw error
    }
  }
}