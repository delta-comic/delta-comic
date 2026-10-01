import { Context, type Fiber, type Plugin } from 'cordis'

import {
  DiagnosticRecorder,
  EventRecorder,
  diagnostic,
  type DiagnosticPluginSnapshot,
  type DiagnosticSnapshot,
  type RecordedEvent,
} from './diagnostic.js'

export interface CordisRuntimeOptions {
  source: string
  context?: Context
  diagnostics?: DiagnosticRecorder
  eventRecorder?: EventRecorder
}

export interface RuntimePluginMetadata {
  readonly version?: string
  readonly dependencies?: readonly string[]
  readonly provides?: readonly string[]
  readonly config?: unknown
}

export class CordisRuntime {
  public readonly context: Context
  public readonly diagnostics: DiagnosticRecorder
  public readonly events: EventRecorder
  readonly #fibers = new Map<string, Fiber>()
  readonly #metadata = new Map<string, RuntimePluginMetadata>()

  public constructor(options: CordisRuntimeOptions) {
    this.context = options.context ?? new Context()
    this.diagnostics = options.diagnostics ?? new DiagnosticRecorder({ source: options.source })
    this.events = options.eventRecorder ?? new EventRecorder()
  }

  public async mount(
    id: string,
    plugin: Plugin,
    config?: unknown,
    metadata: RuntimePluginMetadata = {},
  ): Promise<Fiber> {
    if (this.#fibers.has(id)) throw new Error(`plugin is already mounted: ${id}`)
    this.#metadata.set(id, { ...metadata, config })
    this.diagnostics.record('info', 'plugin mount requested', { pluginId: id })
    const ownsRecording = !this.events.recording
    if (ownsRecording) this.events.start()
    this.events.record('plugin.mount.requested', { pluginId: id })
    try {
      const fiber = await this.context.plugin(plugin, config)
      this.#fibers.set(id, fiber)
      this.diagnostics.record('info', 'plugin mounted', { pluginId: id, state: fiber.state })
      this.events.record('plugin.mounted', { pluginId: id })
      return fiber
    } catch (error) {
      this.diagnostics.record('error', 'plugin mount failed', {
        pluginId: id,
        error: error instanceof Error ? error.message : String(error),
      })
      this.events.record('plugin.mount.failed', { pluginId: id, error })
      throw error
    } finally {
      if (ownsRecording) this.events.stop()
    }
  }

  @diagnostic('runtime plugin unmount')
  public async unmount(id: string): Promise<void> {
    const fiber = this.#fibers.get(id)
    if (!fiber) return
    await fiber.dispose()
    this.#fibers.delete(id)
    this.#metadata.delete(id)
    this.diagnostics.record('info', 'plugin unmounted', { pluginId: id })
    const ownsRecording = !this.events.recording
    if (ownsRecording) this.events.start()
    this.events.record('plugin.unmounted', { pluginId: id })
    if (ownsRecording) this.events.stop()
  }

  public list(): readonly string[] {
    return [...this.#fibers.keys()]
  }

  public snapshot(): DiagnosticSnapshot {
    const plugins: DiagnosticPluginSnapshot[] = [...this.#fibers.entries()].map(([id, fiber]) => {
      const metadata = this.#metadata.get(id)
      return {
        id,
        version: metadata?.version ?? 'unknown',
        state: ['pending', 'loading', 'active', 'failed', 'disposed'][
          fiber.state
        ] as DiagnosticPluginSnapshot['state'],
        dependencies: metadata?.dependencies ?? [],
        fiberId: id,
        ...(metadata?.provides === undefined ? {} : { provides: metadata.provides }),
        ...(metadata?.config === undefined ? {} : { config: metadata.config }),
      }
    })
    return this.diagnostics.snapshot(plugins, undefined, {
      events: this.events
        .list()
        .map(event => ({
          id: event.id,
          event: event.event,
          ...(event.pluginId === undefined ? {} : { pluginId: event.pluginId }),
          callCount: 1,
        })),
      fibers: plugins.map(plugin => ({
        id: plugin.fiberId ?? plugin.id,
        pluginId: plugin.id,
        state: plugin.state,
        disposed: plugin.state === 'disposed',
      })),
      dependencyGraph: {
        nodes: plugins.map(plugin => plugin.id),
        edges: plugins.flatMap(plugin => plugin.dependencies.map(to => ({ from: plugin.id, to }))),
      },
    })
  }

  public startRecording(): void {
    this.events.start()
  }

  public stopRecording(): readonly RecordedEvent[] {
    return this.events.stop()
  }

  public async dispose(): Promise<void> {
    await Promise.all([...this.#fibers.keys()].map(id => this.unmount(id)))
  }
}

export interface MinimalRuntimeOptions {
  readonly plugins: readonly { id: string; module: Plugin; config?: unknown }[]
  readonly mockServices?: Readonly<Record<string, unknown>>
  readonly source?: string
}

export const createMinimalRuntime = async (
  options: MinimalRuntimeOptions,
): Promise<CordisRuntime> => {
  const context = new Context()
  for (const [serviceId, mock] of Object.entries(options.mockServices ?? {})) {
    context.provide(serviceId, mock)
  }
  const runtime = new CordisRuntime({ source: options.source ?? 'minimal-runtime', context })
  for (const plugin of options.plugins) await runtime.mount(plugin.id, plugin.module, plugin.config)
  return runtime
}