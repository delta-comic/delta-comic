import { Context, type Fiber, type Plugin } from 'cordis'

import {
  DiagnosticRecorder,
  diagnostic,
  type DiagnosticPluginSnapshot,
  type DiagnosticSnapshot,
} from './diagnostic.js'

export interface CordisRuntimeOptions {
  source: string
  context?: Context
  diagnostics?: DiagnosticRecorder
}

export class CordisRuntime {
  public readonly context: Context
  public readonly diagnostics: DiagnosticRecorder
  readonly #fibers = new Map<string, Fiber>()

  public constructor(options: CordisRuntimeOptions) {
    this.context = options.context ?? new Context()
    this.diagnostics = options.diagnostics ?? new DiagnosticRecorder({ source: options.source })
  }

  public async mount(id: string, plugin: Plugin, config?: unknown): Promise<Fiber> {
    if (this.#fibers.has(id)) throw new Error(`plugin is already mounted: ${id}`)
    this.diagnostics.record('info', 'plugin mount requested', { pluginId: id })
    try {
      const fiber = await this.context.plugin(plugin, config)
      this.#fibers.set(id, fiber)
      this.diagnostics.record('info', 'plugin mounted', { pluginId: id, state: fiber.state })
      return fiber
    } catch (error) {
      this.diagnostics.record('error', 'plugin mount failed', {
        pluginId: id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  @diagnostic('runtime plugin unmount')
  public async unmount(id: string): Promise<void> {
    const fiber = this.#fibers.get(id)
    if (!fiber) return
    await fiber.dispose()
    this.#fibers.delete(id)
    this.diagnostics.record('info', 'plugin unmounted', { pluginId: id })
  }

  public list(): readonly string[] {
    return [...this.#fibers.keys()]
  }

  public snapshot(): DiagnosticSnapshot {
    const plugins: DiagnosticPluginSnapshot[] = [...this.#fibers.entries()].map(([id, fiber]) => ({
      id,
      version: 'unknown',
      state: ['pending', 'loading', 'active', 'failed', 'disposed'][
        fiber.state
      ] as DiagnosticPluginSnapshot['state'],
      dependencies: [],
    }))
    return this.diagnostics.snapshot(plugins)
  }

  public async dispose(): Promise<void> {
    await Promise.all([...this.#fibers.keys()].map(id => this.unmount(id)))
  }
}