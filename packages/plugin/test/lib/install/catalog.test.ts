import { describe, expect, it } from 'vite-plus/test'

import {
  pluginCatalogIdFromInstallInput,
  pluginCatalogInstallInput,
} from '../../../lib/install/catalog'

describe('plugin catalog install input', () => {
  it('round-trips portable catalog plugin ids', () => {
    const input = pluginCatalogInstallInput('reader_plugin-2')

    expect(input).toBe('ap:reader_plugin-2')
    expect(pluginCatalogIdFromInstallInput(input)).toBe('reader_plugin-2')
  })

  it('rejects ids and inputs outside the persisted catalog protocol', () => {
    expect(() => pluginCatalogInstallInput('../reader')).toThrow('invalid plugin catalog id')
    expect(pluginCatalogIdFromInstallInput('gh:delta-comic/reader')).toBeUndefined()
    expect(pluginCatalogIdFromInstallInput(new File([], 'reader.zip'))).toBeUndefined()
  })
})