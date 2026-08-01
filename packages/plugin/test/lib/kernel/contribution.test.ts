import { describe, expect, it } from 'vitest'

import {
  ContributionHub,
  ContributionRegistry,
  defineContributionChannel,
} from '../../../lib/kernel/contribution'
import { PluginScope } from '../../../lib/kernel/scope'

describe('ContributionRegistry', () => {
  it('keeps source identity and disposes only its own entry', () => {
    const registry = new ContributionRegistry<number>()
    const disposeFirst = registry.register('first', 'action', 1)
    registry.register('second', 'action', 2)

    expect([...registry.values()]).toEqual([
      { id: 'action', owner: 'first', value: 1 },
      { id: 'action', owner: 'second', value: 2 },
    ])

    expect(disposeFirst()).toBe(true)
    expect(registry.get('first', 'action')).toBeUndefined()
    expect(registry.get('second', 'action')?.value).toBe(2)
  })

  it('rejects duplicate owner and id pairs', () => {
    const registry = new ContributionRegistry<number>()
    registry.register('example', 'action', 1)

    expect(() => registry.register('example', 'action', 2)).toThrow(
      'duplicate contribution "example:action"',
    )
  })

  it('adds typed channels without changing the hub and binds them to a scope', async () => {
    const hub = new ContributionHub()
    const channel = defineContributionChannel<{ title: string }>('example:cards')
    const scope = new PluginScope('example')

    hub.register(scope, channel, 'home', { title: 'Home' })
    expect(hub.channel(channel).get('example', 'home')?.value.title).toBe('Home')

    await scope.dispose()
    expect(hub.channel(channel).size).toBe(0)
  })
})