import { logger } from '@delta-comic/logger'

const pluginStartupLogger = logger.scoped('app:plugin-startup')

export interface PluginStartupPreference {
  pluginNames: string[]
  safe: boolean
  version: 1
}

type StartupStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

const storageKey = 'delta-comic:plugin-startup'

const isPreference = (value: unknown): value is PluginStartupPreference => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PluginStartupPreference>
  return (
    candidate.version === 1 &&
    typeof candidate.safe === 'boolean' &&
    Array.isArray(candidate.pluginNames) &&
    candidate.pluginNames.every(name => typeof name === 'string')
  )
}

export class PluginStartupMemory {
  public constructor(
    private readonly storage: StartupStorage | undefined = globalThis.localStorage,
  ) {}

  public clear() {
    this.storage?.removeItem(storageKey)
  }

  public read(): PluginStartupPreference | null {
    try {
      const serialized = this.storage?.getItem(storageKey)
      if (!serialized) return null
      const preference: unknown = JSON.parse(serialized)
      if (isPreference(preference)) return preference
      this.clear()
    } catch (error) {
      pluginStartupLogger.warn('failed to read remembered plugins', error)
      this.clear()
    }
    return null
  }

  public remember(pluginNames: readonly string[], safe: boolean) {
    const preference: PluginStartupPreference = {
      pluginNames: [...new Set(pluginNames)],
      safe,
      version: 1,
    }
    this.storage?.setItem(storageKey, JSON.stringify(preference))
  }
}

export const pluginStartupMemory = new PluginStartupMemory()