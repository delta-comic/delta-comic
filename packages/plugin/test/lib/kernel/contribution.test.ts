import { describe, expect, it } from 'vitest'

import { ContributionRegistry } from '../../../lib/kernel/contribution'

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
})