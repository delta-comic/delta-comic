import { UniResource } from '@delta-comic/model'

import { defineCapability, type CapabilityModule } from '../kernel'

import { selectFastestEndpoint } from './endpointProbe'
import { bindRegistryValue } from './registryBinding'

export const createResourceCapability = (): CapabilityModule =>
  defineCapability({
    id: 'resource',
    select: config => config.model?.resource,
    async activate(resource, context) {
      const names = new Set<string>()
      for (const type of resource.types ?? []) {
        if (!type.type) throw new Error('resource type cannot be empty')
        if (names.has(type.type)) throw new Error(`duplicate resource type "${type.type}"`)
        names.add(type.type)
        const key: [plugin: string, type: string] = [context.owner, type.type]
        bindRegistryValue(context.scope, UniResource.fork, key, type)
        context.report({ name: 'resource', description: `probing ${type.type}` })
        const selected = await selectFastestEndpoint(
          type.urls.map(url => ({ test: type.test, url, value: url })),
          context.signal,
        )
        if (!selected) throw new Error(`no reachable endpoint for resource "${type.type}"`)
        bindRegistryValue(context.scope, UniResource.precedenceFork, key, selected.url)
      }
      for (const [name, process] of Object.entries(resource.process ?? {})) {
        if (!name) throw new Error('resource process name cannot be empty')
        bindRegistryValue(
          context.scope,
          UniResource.processInstances,
          [context.owner, name],
          process,
        )
      }
    },
  })