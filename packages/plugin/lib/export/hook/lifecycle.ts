import type { App } from 'vue'

export interface LifecycleHooks {
  /** Runs after app.use() registration and before app.mount() for preboot plugins. */
  onPreboot?(context: { app: App }): void
  onBooted?(): void
  /** Runs before a normal plugin is reloaded or the runtime is disposed. */
  onUnload?(): void
  /** Runs once before an installed plugin and its persisted files are removed. */
  onUninstall?(): void
}