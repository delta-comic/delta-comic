import type { Remote } from '../api'
import { defineCapability, defineContributionChannel, type CapabilityModule } from '../kernel'

import { selectFastestEndpoint } from './endpointProbe'
import type { PluginCapabilityServices } from './services'

export interface RemoteSelection {
  readonly group: Remote.TestGroup
  readonly latencyMs?: number
  readonly remote: Remote.Definition | false
}

export const pluginRemoteSelectionChannel = defineContributionChannel<RemoteSelection>(
  'runtime:remote-selection',
)

export const createRemoteCapability = (services: PluginCapabilityServices): CapabilityModule =>
  defineCapability({
    id: 'remote',
    select: config =>
      config.model?.remotes ? { hooks: config.hooks, remotes: config.model.remotes } : undefined,
    async activate({ hooks, remotes }, context) {
      const groups = new Set<string>()
      for (const group of remotes) {
        if (!group.name) throw new Error('remote group name cannot be empty')
        if (groups.has(group.name)) throw new Error(`duplicate remote group "${group.name}"`)
        groups.add(group.name)
        context.report({ name: 'remote', description: `probing ${group.name}` })
        const selected = await selectFastestEndpoint(
          group.remotes.map(remote => ({
            test: remote.test ?? group.test,
            url: remote.url,
            value: remote,
          })),
          context.signal,
        )
        if (!selected && !group.allowNoConnected) {
          throw new Error(`no reachable endpoint for remote group "${group.name}"`)
        }
        const selection: RemoteSelection = {
          group,
          latencyMs: selected?.latencyMs,
          remote: selected?.value ?? false,
        }
        services.contributions.register(
          context.scope,
          pluginRemoteSelectionChannel,
          group.name,
          selection,
        )
        hooks?.onRemoteTestDone?.(group, selection.remote)
      }
    },
  })