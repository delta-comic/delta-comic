import { UniResource } from '@delta-comic/model'

import type { Remote } from '../api'
import { defineCapability, defineContributionChannel, type CapabilityModule } from '../kernel'

import { selectFastestEndpoint } from './endpointProbe'
import { bindRegistryValue } from './registryBinding'
import type { PluginCapabilityServices } from './services'

export interface RemoteSelection {
  readonly group: Remote.TestRemoteGroup
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
          if (group.type === 'remote') {
            throw new Error(`no reachable endpoint for remote group "${group.name}"`)
          }
          throw new Error(`no reachable endpoint for resource "${group.name}"`)
        }
        if (group.type === 'resource') {
          bindRegistryValue(
            context.scope,
            UniResource.fork,
            [context.owner, group.name],
            group.remotes.map(remote => remote.url),
          )
          if (selected) {
            bindRegistryValue(
              context.scope,
              UniResource.precedenceFork,
              [context.owner, group.name],
              selected.url,
            )
          }
          const processors = new Set<string>()
          for (const processor of group.processors ?? []) {
            if (!processor.name) throw new Error('resource process name cannot be empty')
            if (processors.has(processor.name)) {
              throw new Error(`duplicate resource process "${processor.name}"`)
            }
            processors.add(processor.name)
            bindRegistryValue(
              context.scope,
              UniResource.processInstances,
              [context.owner, processor.name],
              processor,
            )
          }
          continue
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