import { describe, expect, it } from 'vitest'

import { PluginStore } from '../../../lib/runtime'

describe('PluginStore', () => {
  it('publishes plugin models only after activation is ready', () => {
    const store = new PluginStore()
    const config = { model: { expose: { value: true } }, name: 'reader' }

    store.markLoading('reader', config)
    expect(store.loading.get('reader')).toBe(config)
    expect(store.plugins.has('reader')).toBe(false)
    expect(store.modelEntries('expose')).toEqual([])

    store.markReady('reader')
    expect(store.loading.has('reader')).toBe(false)
    expect(store.plugins.get('reader')).toBe(config)
    expect(store.modelEntries('expose')).toEqual([['reader', { value: true }]])

    store.markUnloaded('reader')
    expect(store.plugins.has('reader')).toBe(false)
  })
})