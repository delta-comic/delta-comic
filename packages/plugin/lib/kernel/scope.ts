export type PluginDisposer = () => Promise<void> | void

export class PluginScope {
  readonly #controller = new AbortController()
  readonly #disposers: PluginDisposer[] = []
  #disposePromise?: Promise<void>

  public constructor(public readonly owner: string) {}

  public get signal() {
    return this.#controller.signal
  }

  public get disposed() {
    return this.#disposePromise !== undefined
  }

  public defer(disposer: PluginDisposer) {
    if (this.disposed) throw new Error(`plugin scope "${this.owner}" is already disposed`)
    this.#disposers.push(disposer)
    return disposer
  }

  public dispose(reason?: unknown) {
    return (this.#disposePromise ??= this.#dispose(reason))
  }

  async #dispose(reason?: unknown) {
    this.#controller.abort(reason)
    const errors: unknown[] = []

    for (const disposer of this.#disposers.reverse()) {
      try {
        await disposer()
      } catch (error) {
        errors.push(error)
      }
    }
    this.#disposers.length = 0

    if (errors.length > 0) {
      throw new AggregateError(errors, `failed to dispose plugin scope "${this.owner}"`)
    }
  }
}