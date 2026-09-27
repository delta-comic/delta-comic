import type { ServerPluginDefinition } from '../../../../lib/plugin'

import coreDiagnostics from './core-diagnostics'
import syncObserver from './sync-observer'

/**
 * Worker-compatible compile-time plugin index.
 *
 * Wrangler does not transform Vite's `import.meta.glob`, so server plugins are
 * collected through ordinary ESM imports. This keeps every runtime definition
 * auditable and bundle-safe while leaving discovery behind a single registry.
 */
export const staticServerPluginDefinitions = [
  coreDiagnostics,
  syncObserver,
] satisfies readonly ServerPluginDefinition[]