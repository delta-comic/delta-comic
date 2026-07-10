import { AppError } from '@/shared/errors'

import type {
  ServerPluginConfig,
  ServerPluginDefinition,
  ServerPluginHealth,
  ServerPluginHost,
  ServerPluginRuntimeContext,
} from '../../../lib/plugin'

import { normalizeServerPluginConfig, validateServerPluginDefinition } from './plugins.manifest'
import { staticServerPluginRegistry } from './plugins.registry'

export abstract class ServerPluginExecutor {
  abstract listDefinitions(): readonly ServerPluginDefinition[]
  abstract getDefinition(pluginId: string): ServerPluginDefinition | undefined
  abstract install(pluginId: string, config: ServerPluginConfig): Promise<void>
  abstract update(
    pluginId: string,
    previousVersion: string,
    config: ServerPluginConfig,
  ): Promise<void>
  abstract start(pluginId: string, config: ServerPluginConfig): Promise<void>
  abstract stop(pluginId: string, config: ServerPluginConfig): Promise<void>
  abstract uninstall(pluginId: string, config: ServerPluginConfig): Promise<void>
  abstract health(pluginId: string, config: ServerPluginConfig): Promise<ServerPluginHealth>
}

export class StaticPluginExecutor extends ServerPluginExecutor {
  private readonly definitions: ReadonlyMap<string, ServerPluginDefinition>

  constructor(
    definitions: Iterable<ServerPluginDefinition> = staticServerPluginRegistry.values(),
    private readonly host: ServerPluginHost = {
      async probeDatabase() {
        return false
      },
      async readMetric() {
        return 0
      },
    },
  ) {
    super()
    const entries = [...definitions].map(definition => {
      const validated = validateServerPluginDefinition(definition)
      return [validated.manifest.id, validated] as const
    })
    this.definitions = new Map(entries)
    if (this.definitions.size !== entries.length) {
      throw new AppError(
        'PLUGIN_DUPLICATE_DEFINITION',
        'static plugin executor received duplicate definitions',
        500,
      )
    }
  }

  listDefinitions(): readonly ServerPluginDefinition[] {
    return [...this.definitions.values()].sort((left, right) =>
      left.manifest.id.localeCompare(right.manifest.id),
    )
  }

  getDefinition(pluginId: string): ServerPluginDefinition | undefined {
    return this.definitions.get(pluginId)
  }

  async install(pluginId: string, config: ServerPluginConfig): Promise<void> {
    const { context, definition } = this.resolve(pluginId, config)
    await definition.runtime.install?.(context)
  }

  async update(
    pluginId: string,
    previousVersion: string,
    config: ServerPluginConfig,
  ): Promise<void> {
    const { context, definition } = this.resolve(pluginId, config)
    if (definition.runtime.update) {
      await definition.runtime.update(context, previousVersion)
      return
    }
    await definition.runtime.install?.(context)
  }

  async start(pluginId: string, config: ServerPluginConfig): Promise<void> {
    const { context, definition } = this.resolve(pluginId, config)
    await definition.runtime.start?.(context)
  }

  async stop(pluginId: string, config: ServerPluginConfig): Promise<void> {
    const { context, definition } = this.resolve(pluginId, config)
    await definition.runtime.stop?.(context)
  }

  async uninstall(pluginId: string, config: ServerPluginConfig): Promise<void> {
    const { context, definition } = this.resolve(pluginId, config)
    await definition.runtime.uninstall?.(context)
  }

  async health(pluginId: string, config: ServerPluginConfig): Promise<ServerPluginHealth> {
    const { context, definition } = this.resolve(pluginId, config)
    return (
      (await definition.runtime.health?.(context)) ?? {
        message: 'static plugin runtime is ready',
        observedAt: Date.now(),
        status: 'healthy',
      }
    )
  }

  private resolve(
    pluginId: string,
    config: ServerPluginConfig,
  ): { context: ServerPluginRuntimeContext; definition: ServerPluginDefinition } {
    const definition = this.definitions.get(pluginId)
    if (!definition) {
      throw new AppError(
        'PLUGIN_DEFINITION_NOT_FOUND',
        `static server plugin definition not found: ${pluginId}`,
        404,
      )
    }
    const normalizedConfig = normalizeServerPluginConfig(definition.manifest, config)
    return {
      context: {
        config: Object.freeze({ ...normalizedConfig }),
        host: this.host,
        pluginId,
        version: definition.manifest.version,
      },
      definition,
    }
  }
}