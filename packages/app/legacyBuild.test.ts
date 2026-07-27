import { describe, expect, it } from 'vitest'

import { legacyBuildOptions } from './legacyBuild'

describe('legacy build', () => {
  it('emits only the ES5-compatible legacy bundle', () => {
    expect(legacyBuildOptions).toEqual({
      targets: ['ie >= 11'],
      renderModernChunks: false,
    })
  })
})
