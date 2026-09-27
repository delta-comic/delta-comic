export type PluginDisposer = () => void | Promise<void>

export class PluginScope {
  readonly owner: string
  readonly signal: AbortSignal
  #controller = new AbortController()
  #disposers: PluginDisposer[] = []
  #disposed = false

  constructor(owner: string) {
    this.owner = owner
    this.signal = this.#controller.signal
  }

  get disposed() {
    return this.#disposed
  }

  defer(disposer: PluginDisposer) {
    if (this.#disposed) throw new Error(`Plugin scope already disposed: ${this.owner}`)
    this.#disposers.push(disposer)
    return disposer
  }

  async dispose() {
    if (this.#disposed) return
    this.#disposed = true
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