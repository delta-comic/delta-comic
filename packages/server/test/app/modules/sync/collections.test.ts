import { describe, expect, it } from 'vitest'

import {
  assertSyncCollection,
  isSyncCollection,
  syncCollectionNames,
  syncCollections,
} from '../../../../app/modules/sync/collections'

describe('sync collection registry', () => {
  it('derives stable ids for every persisted collection shape', () => {
    expect(syncCollections.itemStore.getEntityId({ key: 42 })).toBe('42')
    expect(syncCollections.favouriteCard.getEntityId({ createAt: 123 })).toBe('123')
    expect(syncCollections.favouriteItem.getEntityId({ belongTo: 7, itemKey: 'comic:1' })).toBe(
      '7:comic:1',
    )
    expect(syncCollections.history.getEntityId({ itemKey: 'history-1' })).toBe('history-1')
    expect(syncCollections.recentView.getEntityId({ itemKey: 'recent-1' })).toBe('recent-1')
    expect(syncCollections.subscribe.getEntityId({ key: 'author', plugin: 'demo' })).toBe(
      'demo:author',
    )
    expect(syncCollections.config.getEntityId({ belongTo: 'core' })).toBe('core')
    expect(syncCollectionNames).toEqual([
      'itemStore',
      'favouriteCard',
      'favouriteItem',
      'history',
      'recentView',
      'subscribe',
      'config',
    ])
  })

  it('rejects non-record rows and missing compound key fields with collection context', () => {
    expect(() => syncCollections.itemStore.getEntityId(null)).toThrow('row in itemStore')
    expect(() => syncCollections.itemStore.getEntityId([])).toThrow('row in itemStore')
    expect(() => syncCollections.favouriteCard.getEntityId({ createAt: '' })).toThrow(
      'favouriteCard.createAt is required',
    )
    expect(() => syncCollections.favouriteItem.getEntityId({ belongTo: 1 })).toThrow(
      'favouriteItem.itemKey is required',
    )
    expect(() => syncCollections.subscribe.getEntityId({ key: 'x' })).toThrow(
      'subscribe.plugin is required',
    )
  })

  it('narrows known collection names and reports unsupported names', () => {
    expect(isSyncCollection('config')).toBe(true)
    expect(isSyncCollection('unknown')).toBe(false)
    expect(assertSyncCollection('history')).toBe('history')
    expect(() => assertSyncCollection('unknown')).toThrow('unsupported sync collection: unknown')
  })
})