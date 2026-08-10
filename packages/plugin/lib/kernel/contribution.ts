import { shallowReactive } from 'vue'

import type { PluginScope } from './scope'

export interface Contribution<T> {
  readonly owner: string
  readonly id: string
  readonly value: T
}

export interface ContributionChannel<T, Owners extends Record<keyof Owners, T> = Record<never, T>> {
  readonly key: string
  readonly __type?: T
  readonly __owners?: Owners
}

export const defineContributionChannel = <
  T,
  Owners extends Record<keyof Owners, T> = Record<never, T>,
>(
  key: string,
): ContributionChannel<T, Owners> => ({ key })

export type ContributionValue<
  T,
  Owners extends Record<keyof Owners, T>,
  Owner extends string,
> = Owner extends keyof Owners ? Owners[Owner] : T

const contributionKey = (owner: string, id: string) => JSON.stringify([owner, id])

export class ContributionRegistry<T, Owners extends Record<keyof Owners, T> = Record<never, T>> {
  readonly #entries = shallowReactive(new Map<string, Contribution<T>>())

  public get size() {
    return this.#entries.size
  }

  public get entries(): ReadonlyMap<string, Contribution<T>> {
    return this.#entries
  }

  public register<Owner extends string>(
    owner: Owner,
    id: string,
    value: ContributionValue<T, Owners, Owner>,
  ) {
    if (!owner) throw new Error('contribution owner cannot be empty')
    if (!id) throw new Error('contribution id cannot be empty')

    const key = contributionKey(owner, id)
    if (this.#entries.has(key)) {
      throw new Error(`duplicate contribution "${owner}:${id}"`)
    }

    const contribution: Contribution<T> = { id, owner, value: value as T }
    this.#entries.set(key, contribution)

    let active = true
    return () => {
      if (!active) return false
      active = false
      return this.#entries.delete(key)
    }
  }

  public get<Owner extends string>(owner: Owner, id: string) {
    type Value = ContributionValue<T, Owners, Owner>
    return this.#entries.get(contributionKey(owner, id)) as Contribution<Value> | undefined
  }

  public byOwner<Owner extends string>(owner: Owner) {
    type Value = ContributionValue<T, Owners, Owner>
    return [...this.#entries.values()].filter(
      entry => entry.owner === owner,
    ) as Contribution<Value>[]
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

  public channel<T, Owners extends Record<keyof Owners, T> = Record<never, T>>(
    channel: ContributionChannel<T, Owners>,
  ): ContributionRegistry<T, Owners> {
    let registry = this.registries.get(channel.key)
    if (!registry) {
      registry = new ContributionRegistry<unknown>()
      this.registries.set(channel.key, registry)
    }
    return registry as unknown as ContributionRegistry<T, Owners>
  }

  public register<T, Owners extends Record<keyof Owners, T> = Record<never, T>>(
    scope: PluginScope,
    channel: ContributionChannel<T, Owners>,
    id: string,
    value: T,
  ) {
    const unregister = this.channel(channel).register<string>(
      scope.owner,
      id,
      value as ContributionValue<T, Owners, string>,
    )
    scope.defer(() => void unregister())
    return unregister
  }

  public removeOwner(owner: string) {
    for (const registry of this.registries.values()) registry.removeOwner(owner)
  }
}