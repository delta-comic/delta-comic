import type { App } from 'vue'

export type PluginLifecycleCleanup = () => Promise<void> | void

export interface LifecycleHooks {
  /** Runs after app.use() registration and before app.mount() for preboot plugins. */
  onPreboot?(context: {
    app: App
  }): PluginLifecycleCleanup | Promise<PluginLifecycleCleanup | void> | void
  onBooted?(): Promise<void> | void
  /** Runs before a normal plugin is reloaded or the runtime is disposed. */
  onUnload?(): Promise<void> | void
  /** Runs once before an installed plugin and its persisted files are removed. */
  onUninstall?(): Promise<void> | void
}