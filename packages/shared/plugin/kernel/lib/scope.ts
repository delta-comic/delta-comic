export type PluginDisposer = () => void | Promise<void>

export interface PluginScopeDiagnostics {
  record(level: 'error' | 'info', message: string, details?: Record<string, unknown>): unknown
}

export type PluginScopeState = 'active' | 'failed' | 'disposed'

export class PluginScope {
  readonly owner: string
  readonly signal: AbortSignal
  #controller = new AbortController()
  #disposers: PluginDisposer[] = []
  #disposed = false
  #state: PluginScopeState = 'active'
  readonly #diagnostics: PluginScopeDiagnostics | undefined

  constructor(owner: string, options: { diagnostics?: PluginScopeDiagnostics } = {}) {
    this.owner = owner
    this.signal = this.#controller.signal
    this.#diagnostics = options.diagnostics
  }

  get disposed() {
    return this.#disposed
  }

  get state(): PluginScopeState {
    return this.#state
  }

  defer(disposer: PluginDisposer) {
    if (this.#disposed) throw new Error(`Plugin scope already disposed: ${this.owner}`)
    this.#disposers.push(disposer)
    return disposer
  }

  async safeCall<T>(operation: () => T | Promise<T>, context: string): Promise<T | undefined> {
    if (this.#disposed) return undefined
    try {
      return await operation()
    } catch (error) {
      this.#state = 'failed'
      this.#diagnostics?.record('error', 'plugin scope call failed', {
        owner: this.owner,
        context,
        error: error instanceof Error ? error.message : String(error),
      })
      return undefined
    }
  }

  async dispose() {
    if (this.#disposed) return
    this.#disposed = true
    this.#state = 'disposed'
    this.#controller.abort()
    const errors: unknown[] = []
    for (const disposer of this.#disposers.toReversed()) {
      try {
        await disposer()
      } catch (error) {
        errors.push(error)
      }
    }
    this.#disposers = []
    if (errors.length > 0)
      throw new AggregateError(errors, `Failed to dispose plugin scope: ${this.owner}`)
  }
}