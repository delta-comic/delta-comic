import { describe, expect, it, vi } from 'vite-plus/test'

import { rewriteCssAssetUrls } from '../../../../../lib/features/core/loaders/1_zip'

describe('zip plugin css assets', () => {
  it('rewrites relative assets while preserving external and data URLs', async () => {
    const createAssetUrl = vi.fn(async (path: string) => `blob:${path}`)
    const css = [
      '.cover { background: url(../images/cover.png#hero) }',
      '@font-face { src: url("./fonts/main.woff2?v=2") }',
      '.remote { background: url(https://example.com/image.png) }',
      '.inline { background: url(data:image/png;base64,AAAA) }',
    ].join('\n')

    await expect(rewriteCssAssetUrls('styles/index.css', css, createAssetUrl)).resolves.toBe(
      [
        '.cover { background: url("blob:images/cover.png#hero") }',
        '@font-face { src: url("blob:styles/fonts/main.woff2?v=2") }',
        '.remote { background: url(https://example.com/image.png) }',
        '.inline { background: url(data:image/png;base64,AAAA) }',
      ].join('\n'),
    )
    expect(createAssetUrl).toHaveBeenCalledTimes(2)
  })
})