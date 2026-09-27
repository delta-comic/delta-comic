import type { PluginManifest } from '@delta-comic/plugin-manifest'
import type { Context, Plugin } from 'cordis'

export type CordisPlugin = Plugin

export interface PluginContract {
  manifest: PluginManifest
  entry: CordisPlugin
}

export interface PluginContextFactory {
  create(manifest: PluginManifest): Context
}

export const definePluginContract = (
  manifest: PluginManifest,
  entry: CordisPlugin,
): PluginContract => ({ manifest, entry })