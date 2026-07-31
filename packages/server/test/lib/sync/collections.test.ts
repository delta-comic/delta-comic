import { describe, expect, it } from 'vitest'

import {
  assertSyncCollection,
  getSyncEntityId,
  isSyncCollection,
  syncCollectionNames,
} from '../../../lib/sync/collections'

describe('cloud sync collections', () => {
  it('derives ids for every supported client collection', () => {
    expect(getSyncEntityId('itemStore', { key: 1 })).toBe('1')
    expect(getSyncEntityId('favouriteCard', { createAt: 2 })).toBe('2')
    expect(getSyncEntityId('favouriteItem', { belongTo: 3, itemKey: 'comic' })).toBe('3:comic')
    expect(getSyncEntityId('history', { itemKey: 'history' })).toBe('history')
    expect(getSyncEntityId('recentView', { itemKey: 'recent' })).toBe('recent')
    expect(getSyncEntityId('subscribe', { key: 'author', plugin: 'demo' })).toBe('demo:author')
    expect(getSyncEntityId('config', { belongTo: 'core' })).toBe('core')
  })

  it('validates collection names and record identity fields', () => {
    expect(syncCollectionNames).toHaveLength(7)
    expect(isSyncCollection('config')).toBe(true)
    expect(isSyncCollection('unknown')).toBe(false)
    expect(assertSyncCollection('history')).toBe('history')
    expect(() => assertSyncCollection('unknown')).toThrow('unsupported sync collection')
    expect(() => getSyncEntityId('config', null)).toThrow('row in config must be an object')
    expect(() => getSyncEntityId('config', [])).toThrow('row in config must be an object')
    expect(() => getSyncEntityId('config', { belongTo: '' })).toThrow('config.belongTo is required')
  })
})