import { describe, expect, it } from 'vite-plus/test'

import coreFeature, { coreConfig } from '../../../../lib/features/core/feature'
import pluginPackage from '../../../../package.json'

describe('core built-in feature', () => {
  it('is enabled by default as a preboot plugin and exposes core settings', () => {
    expect(coreFeature).toMatchObject({
      enabledByDefault: true,
      meta: {
        kind: 'preboot',
        name: { id: 'core' },
        version: { plugin: pluginPackage.version, supportCore: pluginPackage.version },
      },
    })

    const config = coreFeature.config({ platform: 'web', safe: true })
    expect(config).toEqual({ config: [coreConfig], name: 'core' })
  })
})