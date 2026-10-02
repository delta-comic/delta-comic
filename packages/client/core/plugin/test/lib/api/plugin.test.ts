import { describe, expect, it } from 'vitest'

import {
  ConfigPointer,
  defineDeltaComicPlugin,
  DELTA_COMIC_PLUGIN_API_VERSION,
} from '../../../lib/api'

describe('plugin public api', () => {
  it('normalizes declarative definitions to a factory', () => {
    const config = new ConfigPointer(
      'example',
      { enabled: { defaultValue: true, info: 'example.enabled', type: 'switch' } },
      'example.config',
    )
    const factory = defineDeltaComicPlugin({ config, name: 'example' })

    expect(factory({ platform: 'web' })).toEqual({ config, name: 'example' })
  })

  it('publishes one explicit manifest api version', () => {
    expect(DELTA_COMIC_PLUGIN_API_VERSION).toBe(1)
  })
})