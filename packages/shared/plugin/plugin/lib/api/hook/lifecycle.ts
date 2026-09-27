import type { App } from 'vue'

export type PluginLifecycleCleanup = () => Promise<void> | void

export interface LifecycleHooks {
  /** Runs once before app.mount() for every plugin enabled at application startup. */
  onPreboot?(context: {
    app: App
  }): PluginLifecycleCleanup | Promise<PluginLifecycleCleanup | void> | void
  onBooted?(): Promise<void> | void
  /** Runs before the plugin's normal part is reloaded or unloaded. */
  onUnload?(): Promise<void> | void
  /** Runs once before an installed plugin and its persisted files are removed. */
  onUninstall?(): Promise<void> | void
}