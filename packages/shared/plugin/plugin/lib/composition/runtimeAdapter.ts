import type { PluginArchiveDB } from '@delta-comic/db'
import type { PluginConfig } from '@delta-comic/plugin-api'
import type { PluginModuleReader } from '@delta-comic/plugin-install'
import type {
  CapabilityModule as RuntimeCapabilityModule,
  PluginCandidate,
} from '@delta-comic/plugin-kernel'
import type { LoadedPluginModule } from '@delta-comic/plugin-loader'
import type { PluginManifest } from '@delta-comic/plugin-manifest'

import type { DCPluginConfig } from '../api'
import type { CapabilityModule as LegacyCapabilityModule } from '../kernel'
import type { PluginScope as LegacyPluginScope } from '../kernel'

type LegacyModule = Awaited<ReturnType<PluginModuleReader['read']>>

/**
 * The install subsystem still speaks the legacy manifest/module protocol. Keep that conversion at
 * the composition boundary until Install is migrated to the standalone Runtime contracts.
 */
export const toRuntimeManifest = (manifest: PluginArchiveDB.Archive['meta']): PluginManifest => ({
  protocolVersion: 1,
  id: manifest.name.id,
  name: manifest.name.display,
  version: manifest.version.plugin,
  author: manifest.author,
  description: manifest.description,
  entry: 'index.js',
  entryType: 'plugin',
  dependencies: manifest.require.map(dependency => ({
    id: dependency.id,
    ...(dependency.download ? { version: dependency.download } : {}),
  })),
  resources: [],
})

const toRuntimeModule = (module: LegacyModule): LoadedPluginModule => ({
  factory: environment =>
    module.factory({
      platform: environment.platform === 'tauri' ? 'tauri' : 'web',
    }) as PluginConfig,
  activate: module.activate
    ? scope => module.activate?.(scope as Parameters<NonNullable<LegacyModule['activate']>>[0])
    : undefined,
  dispose: module.dispose,
})

export const toRuntimeCandidate = (
  archive: PluginArchiveDB.Archive,
  reader: PluginModuleReader,
): PluginCandidate => ({
  enabled: archive.enable,
  management: { canDisable: true, canUninstall: true, canUpdate: archive.installInput.length > 0 },
  manifest: toRuntimeManifest(archive.meta),
  origin: 'installed',
  load: async signal => toRuntimeModule(await reader.read(archive, signal)),
})

export const adaptLegacyCapabilities = (
  modules: readonly LegacyCapabilityModule[],
): readonly RuntimeCapabilityModule[] =>
  modules.map(module => ({
    id: module.id,
    activate: async (plugin, context) =>
      module.activate(plugin as DCPluginConfig, {
        owner: context.owner,
        // Legacy capability modules only use owner/signal/defer. The class-private fields make
        // the otherwise compatible scope types nominal, so keep this assertion at the adapter edge.
        scope: context.scope as unknown as LegacyPluginScope,
        signal: context.signal,
        report: update => {
          const legacyUpdate = typeof update === 'string' ? { name: module.id } : update
          context.report({ capability: legacyUpdate.name ?? module.id, state: 'completed' })
        },
      }),
  }))