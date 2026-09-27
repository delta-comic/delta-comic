import { describe, expect, it } from 'vitest'

import { definePluginContract } from '../lib/index.js'

describe('@delta-comic/plugin-api', () => {
  it('defines a platform-neutral Cordis plugin contract', () => {
    const entry = () => undefined
    const manifest = {
      protocolVersion: 1 as const,
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      entry: 'index.js',
      entryType: 'plugin' as const,
      resources: [],
    }
    expect(definePluginContract(manifest, entry)).toEqual({ manifest, entry })
  })
})