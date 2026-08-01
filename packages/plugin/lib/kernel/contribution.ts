import { shallowReactive } from 'vue'

import type { PluginScope } from './scope'

export interface Contribution<T> {
  readonly owner: string
  readonly id: string
  readonly value: T
}

export interface ContributionChannel<T> {
  readonly key: string
  readonly __type?: T
}

export const defineContributionChannel = <T>(key: string): ContributionChannel<T> => ({ key })

const contributionKey = (owner: string, id: string) => JSON.stringify([owner, id])

export class ContributionRegistry<T> {
  readonly #entries = shallowReactive(new Map<string, Contribution<T>>())

  public get size() {
    return this.#entries.size
  }

  public get entries(): ReadonlyMap<string, Contribution<T>> {
    return this.#entries
  }

  public register(owner: string, id: string, value: T) {
    if (!owner) throw new Error('contribution owner cannot be empty')
    if (!id) throw new Error('contribution id cannot be empty')

    const key = contributionKey(owner, id)
    if (this.#entries.has(key)) {
      throw new Error(`duplicate contribution "${owner}:${id}"`)
    }

    const contribution: Contribution<T> = { id, owner, value }
    this.#entries.set(key, contribution)

    let active = true
    return () => {
      if (!active) return false
      active = false
      return this.#entries.delete(key)
    }
  }

  public get(owner: string, id: string) {
    return this.#entries.get(contributionKey(owner, id))
  }

  public byOwner(owner: string) {
    return [...this.#entries.values()].filter(entry => entry.owner === owner)
  }

  public removeOwner(owner: string) {
    for (const [key, entry] of this.#entries) {
      if (entry.owner === owner) this.#entries.delete(key)
    }
  }

  public values() {
    return this.#entries.values()
  }
}

export class ContributionHub {
  private readonly registries = new Map<string, ContributionRegistry<unknown>>()

  public channel<T>(channel: ContributionChannel<T>): ContributionRegistry<T> {
    let registry = this.registries.get(channel.key)
    if (!registry) {
      registry = new ContributionRegistry<unknown>()
      this.registries.set(channel.key, registry)
    }
    return registry as ContributionRegistry<T>
  }

  public register<T>(scope: PluginScope, channel: ContributionChannel<T>, id: string, value: T) {
    const unregister = this.channel(channel).register(scope.owner, id, value)
    scope.defer(() => void unregister())
    return unregister
  }

  public removeOwner(owner: string) {
    for (const registry of this.registries.values()) registry.removeOwner(owner)
  }
}