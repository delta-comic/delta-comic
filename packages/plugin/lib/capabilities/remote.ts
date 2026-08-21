import { UniResource } from '@delta-comic/model'

import type { Remote } from '../api'
import { defineCapability, defineContributionChannel, type CapabilityModule } from '../kernel'

import { selectFastestEndpoint } from './endpointProbe'
import { bindRegistryValue } from './registryBinding'
import type { PluginCapabilityServices } from './services'

const resolveGroup = async (
  group: Remote.TestGroup,
  signal: AbortSignal,
): Promise<Remote.ResolvedTestGroup> => {
  const sources = typeof group.remotes === 'function' ? [group.remotes] : group.remotes
  const remotes = (
    await Promise.all(
      sources.map(source => (typeof source === 'function' ? source(signal) : source)),
    )
  ).flat()

  return { ...group, remotes }
}

export interface RemoteSelection {
  readonly group: Remote.ResolvedTestRemoteGroup
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
      for (const sourceGroup of remotes) {
        if (!sourceGroup.name) throw new Error('remote group name cannot be empty')
        if (groups.has(sourceGroup.name)) {
          throw new Error(`duplicate remote group "${sourceGroup.name}"`)
        }
        groups.add(sourceGroup.name)
        context.report({ name: 'remote', description: `probing ${sourceGroup.name}` })
        const group = await resolveGroup(sourceGroup, context.signal)
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