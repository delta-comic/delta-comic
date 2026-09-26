import {
  CordisRuntime,
  diagnostic,
  type Context,
  type DiagnosticSnapshot,
  type Plugin,
} from '@delta-comic/both'

import { createClientDownloader, type ClientDownloader } from './downloader.js'
import {
  instrumentClientDatabase,
  instrumentClientStore,
  type ClientDatabase,
  type ClientHost,
  type ClientStore,
  type ClientUi,
  type ClientUiRegistrars,
} from './host.js'
import { createClientNetwork, type ClientNetwork } from './network.js'
import { createClientUi } from './ui.js'

export interface ClientRuntimeOptions<DB extends object = Record<string, never>> {
  pluginId: string
  context?: Context
  database: ClientDatabase<DB>
  store?: ClientStore
  ui?: ClientUi
  uiRegistrars?: ClientUiRegistrars
  downloader?: ClientDownloader
  network?: ClientNetwork
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

export class ClientRuntime<DB extends object = Record<string, never>> {
  readonly #runtime: CordisRuntime
  readonly #host: ClientHost<DB>
  readonly #ownsDownloader: boolean
  #hostMounted = false

  public constructor(options: ClientRuntimeOptions<DB>) {
    this.#runtime = new CordisRuntime({
      source: `client:${options.pluginId}`,
      context: options.context,
    })
    this.#ownsDownloader = options.downloader === undefined
    this.#host = {
      pluginId: options.pluginId,
      diagnostics: this.#runtime.diagnostics,
      db: instrumentClientDatabase(options.database, this.#runtime.diagnostics, options.pluginId),
      store: instrumentClientStore(
        options.store ?? defaultStore(),
        this.#runtime.diagnostics,
        options.pluginId,
      ),
      ui: options.ui ?? createClientUi(options.pluginId, options.uiRegistrars),
      downloader:
        options.downloader ??
        createClientDownloader(this.#runtime.diagnostics, options.pluginId, {
          key: `plugin:${options.pluginId}`,
        }),
      network: options.network ?? createClientNetwork(this.#runtime.diagnostics, options.pluginId),
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
  public async dispose(): Promise<void> {
    try {
      await this.#runtime.dispose()
    } finally {
      if (this.#ownsDownloader) this.#host.downloader?.dispose()
      this.#host.ui.dispose?.()
    }
  }
}

declare module 'cordis' {
  interface Context {
    client: ClientHost
  }
}