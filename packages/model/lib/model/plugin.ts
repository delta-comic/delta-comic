export const DELTA_COMIC_PLUGIN_API_VERSION = 1 as const

export interface PluginManifest {
  apiVersion: typeof DELTA_COMIC_PLUGIN_API_VERSION
  name: { display: string; id: string }
  version: { plugin: string; supportCore: string }
  author: string
  description: string
  /** An HTTP(S) URL or a path relative to the installed plugin root. */
  icon?: string
  require: { id: string; download?: string }[]
  entry?: { jsPath: string; cssPath?: string }
  integrity?: { algorithm: 'blake3' | 'sha256'; digest: string }
}