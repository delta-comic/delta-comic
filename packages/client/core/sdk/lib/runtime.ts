import {
  CordisRuntime,
  diagnostic,
  type Context,
  type DiagnosticSnapshot,
  type Plugin,
} from '@delta-comic/both'

import {
  instrumentClientDatabase,
  instrumentClientStore,
  type ClientDatabase,
  type ClientHost,
  type ClientStore,
  type ClientUi,
} from './host.js'

export interface ClientRuntimeOptions<DB extends object = Record<string, never>> {
  pluginId: string
  context?: Context
  database: ClientDatabase<DB>
  store?: ClientStore
  ui?: ClientUi
}

const defaultStore = (): ClientStore => {
  const values = new Map<string, unknown>()
  return {
    get: <T>(key: string) => values.get(key) as T | undefined,
    set: (key, value) => void values.set(key, value),
    delete: key => values.delete(key),
    keys: () => [...values.keys()],
  }
}

const defaultUi = (): ClientUi => {
  const disposers = new Set<() => void>()
  const register = (): (() => void) => {
    const disposer = () => void disposers.delete(disposer)
    disposers.add(disposer)
    return disposer
  }
  return { registerRoute: register, registerNavItem: register, registerCommand: register }
}

export class ClientRuntime<DB extends object = Record<string, never>> {
  readonly #runtime: CordisRuntime
  readonly #host: ClientHost<DB>
  #hostMounted = false

  public constructor(options: ClientRuntimeOptions<DB>) {
    this.#runtime = new CordisRuntime({
      source: `client:${options.pluginId}`,
      context: options.context,
    })
    this.#host = {
      pluginId: options.pluginId,
      diagnostics: this.#runtime.diagnostics,
      db: instrumentClientDatabase(options.database, this.#runtime.diagnostics, options.pluginId),
      store: instrumentClientStore(
        options.store ?? defaultStore(),
        this.#runtime.diagnostics,
        options.pluginId,
      ),
      ui: options.ui ?? defaultUi(),
    }
  }

  public get context(): Context {
    return this.#runtime.context
  }

  public get host(): ClientHost<DB> {
    return this.#host
  }

  public get diagnostics() {
    return this.#runtime.diagnostics
  }

  @diagnostic('client plugin mount')
  public async mount(id: string, plugin: Plugin, config?: unknown) {
    if (!this.#hostMounted) {
      await this.context.plugin(ctx => ctx.provide('client', this.#host))
      this.#hostMounted = true
    }
    return this.#runtime.mount(id, plugin, config)
  }

  public snapshot(): DiagnosticSnapshot {
    return this.#runtime.snapshot()
  }

  @diagnostic('client plugin unmount')
  public unmount(id: string): Promise<void> {
    return this.#runtime.unmount(id)
  }

  @diagnostic('client runtime dispose')
  public dispose(): Promise<void> {
    return this.#runtime.dispose()
  }
}

declare module 'cordis' {
  interface Context {
    client: ClientHost
  }
}