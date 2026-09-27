import type { PluginArchiveDB } from '@delta-comic/db'

import type {
  DecodedPluginPackage,
  PluginArchiveRepository,
  PluginFileStore,
  PluginInstallInput,
  PluginInstallReporter,
  PluginPackageCodec,
  PluginSourceResolver,
  ResolvedPluginSource,
} from './contracts'

export interface PluginInstallServiceOptions {
  readonly codecs: readonly PluginPackageCodec[]
  readonly files: PluginFileStore
  readonly repository: PluginArchiveRepository
  readonly reservedIds?: ReadonlySet<string>
  readonly resolvers: readonly PluginSourceResolver[]
}

interface PluginInstallContext {
  readonly installing: Set<string>
  readonly installed: Set<string>
  readonly added: string[]
}

export class PluginInstallService {
  public constructor(private readonly options: PluginInstallServiceOptions) {}

  public async install(
    input: PluginInstallInput,
    signal = new AbortController().signal,
    report: PluginInstallReporter = () => {},
  ) {
    const context: PluginInstallContext = { added: [], installed: new Set(), installing: new Set() }
    try {
      return await this.#install(input, signal, report, context)
    } catch (error) {
      const rollbackErrors: unknown[] = [error]
      for (const plugin of [...context.added].reverse()) {
        try {
          await this.uninstall(plugin)
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (rollbackErrors.length === 1) throw error
      throw new AggregateError(rollbackErrors, 'failed to install plugin dependencies')
    }
  }

  async #install(
    input: PluginInstallInput,
    signal: AbortSignal,
    report: PluginInstallReporter,
    context: PluginInstallContext,
    expectedPlugin?: string,
  ) {
    report({ phase: 'resolve', progress: 0 })
    const resolver = this.options.resolvers.find(candidate => candidate.matches(input))
    if (!resolver) throw new Error('no plugin source resolver accepts this input')
    const source = await resolver.resolve(input, signal, report)
    report({
      description: source.file?.name ?? source.installInput,
      phase: 'resolve',
      progress: 100,
    })

    const decoded = source.package ?? (await this.#decode(source, signal, report))
    const plugin = decoded.manifest.name.id
    if (this.options.reservedIds?.has(plugin)) {
      throw new Error(`plugin id "${plugin}" is reserved by an internal plugin`)
    }
    if (expectedPlugin && plugin !== expectedPlugin) {
      throw new Error(`plugin dependency "${expectedPlugin}" downloaded as "${plugin}"`)
    }
    if (context.installing.has(plugin)) {
      throw new Error(`plugin dependency cycle includes "${plugin}"`)
    }
    report({ description: plugin, phase: 'decode', progress: 100 })

    context.installing.add(plugin)
    try {
      for (const dependency of decoded.manifest.require) {
        if (
          this.options.reservedIds?.has(dependency.id) ||
          context.installed.has(dependency.id) ||
          (await this.options.repository.find(dependency.id))
        ) {
          context.installed.add(dependency.id)
          continue
        }
        if (!dependency.download) continue
        await this.#install(dependency.download, signal, report, context, dependency.id)
      }

      const previous = await this.options.repository.find(plugin)
      const replacement = await this.options.files.replace(
        plugin,
        source.storage === 'remote' ? new Map() : decoded.files,
      )
      const archive: PluginArchiveDB.Archive = {
        displayName: decoded.manifest.name.display,
        enable: previous?.enable ?? true,
        installerName: source.resolverId,
        installInput: source.installInput,
        loaderName: source.package?.codecId ?? decoded.codecId,
        meta: decoded.manifest,
        pluginName: plugin,
      }

      try {
        report({ description: plugin, phase: 'persist', progress: 50 })
        await this.options.repository.upsert(archive)
        await replacement.commit()
        report({ description: plugin, phase: 'persist', progress: 100 })
        context.installed.add(plugin)
        if (!previous) context.added.push(plugin)
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
          throw new AggregateError(
            [error, ...rollbackErrors],
            `failed to install plugin "${plugin}"`,
          )
        }
        throw error
      }
    } finally {
      context.installing.delete(plugin)
    }
  }

  async #decode(
    source: ResolvedPluginSource,
    signal: AbortSignal,
    report: PluginInstallReporter,
  ): Promise<DecodedPluginPackage> {
    const file = source.file
    if (!file) throw new Error('resolved plugin source contains neither a file nor a package')
    const codec = this.options.codecs.find(candidate => candidate.matches(file))
    if (!codec) throw new Error('no plugin package codec accepts this file')
    report({ description: codec.id, phase: 'decode', progress: 0 })
    const decoded = await codec.decode(file, signal)
    return decoded
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