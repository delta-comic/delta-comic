import { shallowReactive } from 'vue'

import type { PluginScope } from './scope'

export interface Contribution<T, O extends string = string> {
  readonly owner: O
  readonly value: T
}

export interface ContributionChannel<T, O extends string = string> {
  readonly id: string
  readonly create: (owner: O, value: T) => Contribution<T, O>
}

export const defineContributionChannel = <T, O extends string = string>(
  id: string,
): ContributionChannel<T, O> => ({ id, create: (owner, value) => ({ owner, value }) })

export type ContributionValue<T, O extends string = string> = Contribution<T, O>

export class ContributionRegistry<T, O extends string = string> {
  readonly #values = shallowReactive(new Map<string, Contribution<T, O>>())

  register(id: string, contribution: Contribution<T, O>) {
    if (this.#values.has(id)) throw new Error(`Contribution already registered: ${id}`)
    this.#values.set(id, contribution)
    return () => this.#values.delete(id)
  }

  get(id: string) {
    return this.#values.get(id)
  }

  byOwner(owner: O) {
    return [...this.#values.values()].filter(value => value.owner === owner)
  }

  removeOwner(owner: O) {
    for (const [id, value] of this.#values) if (value.owner === owner) this.#values.delete(id)
  }

  values() {
    return [...this.#values.values()]
  }
}

export class ContributionHub<T, O extends string = string> {
  readonly #channel: ContributionChannel<T, O>
  readonly #registry = new ContributionRegistry<T, O>()

  constructor(channel: ContributionChannel<T, O>) {
    this.#channel = channel
  }

  register(scope: PluginScope, id: string, owner: O, value: T) {
    const remove = this.#registry.register(id, this.#channel.create(owner, value))
    scope.defer(() => {
      remove()
    })
    return remove
  }

  removeOwner(owner: O) {
    this.#registry.removeOwner(owner)
  }

  get registry() {
    return this.#registry
  }
}