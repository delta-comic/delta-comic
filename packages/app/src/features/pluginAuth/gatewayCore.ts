import type { PluginAuthGateway, User } from '@delta-comic/plugin'

export const raceAbort = <T>(operation: Promise<T>, signal: AbortSignal) => {
  if (signal.aborted) return Promise.reject<T>(signal.reason)
  let removeAbortListener = () => {}
  const aborted = new Promise<never>((_, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    removeAbortListener = () => signal.removeEventListener('abort', abort)
  })
  return Promise.race([operation, aborted]).finally(removeAbortListener)
}

export const createPluginAuthGateway = (
  chooseSelection: (
    plugin: string,
    selections: readonly User.Selection[],
    signal: AbortSignal,
  ) => Promise<string>,
  createAuthMethod: (plugin: string, signal: AbortSignal) => User.Method,
): PluginAuthGateway => ({
  async authenticate(plugin, auth, signal) {
    signal.throwIfAborted()
    const preferred = await raceAbort(auth.default(), signal)
    if (preferred === true) return
    const selectionId =
      typeof preferred === 'string'
        ? preferred
        : await chooseSelection(plugin, auth.selections, signal)
    const selection = auth.selections.find(candidate => candidate.id === selectionId)
    if (!selection) {
      throw new Error(`plugin "${plugin}" selected an unknown authentication method`)
    }
    await raceAbort(selection.call(createAuthMethod(plugin, signal)), signal)
  },
})