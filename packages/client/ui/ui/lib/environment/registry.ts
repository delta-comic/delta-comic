import { shallowReactive, type Component, type Raw } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

export interface GlobalEnvironments extends Record<string, Component> {}

export type EnvironmentKey = Extract<keyof GlobalEnvironments, string>

export interface EnvironmentRegistration<
  TKey extends EnvironmentKey = EnvironmentKey,
  TComponent extends GlobalEnvironments[TKey] = GlobalEnvironments[TKey],
> {
  readonly component: Raw<TComponent>
  readonly condition: (args: ComponentProps<TComponent>) => boolean | Promise<boolean>
  readonly id: symbol
  readonly key: TKey
}

interface OwnedEnvironmentRegistration {
  owner?: string
  registration: EnvironmentRegistration
}

export class EnvironmentRegistry {
  private readonly entries = shallowReactive(new Array<OwnedEnvironmentRegistration>())
  private readonly owners: string[] = []

  public register<
    TKey extends EnvironmentKey,
    TComponent extends GlobalEnvironments[TKey] = GlobalEnvironments[TKey],
  >(
    key: TKey,
    component: Raw<TComponent>,
    condition: EnvironmentRegistration<TKey, TComponent>['condition'] = () => true,
    owner = this.owners.at(-1),
  ) {
    const entry: OwnedEnvironmentRegistration = {
      owner,
      registration: { component, condition, id: Symbol(`environment:${key}`), key },
    }
    this.entries.push(entry)
    return () => {
      const index = this.entries.indexOf(entry)
      if (index >= 0) this.entries.splice(index, 1)
    }
  }

  public forKey<TKey extends EnvironmentKey>(key: TKey) {
    return this.entries
      .map(entry => entry.registration)
      .filter(
        (registration): registration is EnvironmentRegistration<TKey> => registration.key === key,
      )
  }

  public removeOwner(owner: string) {
    for (let index = this.entries.length - 1; index >= 0; index--) {
      if (this.entries[index].owner === owner) this.entries.splice(index, 1)
    }
  }

  public async withOwner<T>(owner: string, action: () => Promise<T>): Promise<T> {
    this.owners.push(owner)
    try {
      return await action()
    } finally {
      this.owners.pop()
    }
  }
}

export const environmentRegistry = new EnvironmentRegistry()

export const addEnvironment = <
  TKey extends EnvironmentKey,
  TComponent extends GlobalEnvironments[TKey] = GlobalEnvironments[TKey],
>(
  key: TKey,
  component: Raw<TComponent>,
  condition?: EnvironmentRegistration<TKey, TComponent>['condition'],
  owner?: string,
) => environmentRegistry.register(key, component, condition, owner)