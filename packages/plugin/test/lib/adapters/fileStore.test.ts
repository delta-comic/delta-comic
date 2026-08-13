import { beforeEach, describe, expect, it, vi } from 'vitest'

const convertFileSrc = vi.fn(() => 'plugin://localhost/')

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc, isTauri: () => false }))

describe('plugin protocol URLs', () => {
  beforeEach(() => convertFileSrc.mockClear())

  it('preserves path segments for relative module resolution', async () => {
    const { createPluginProtocolUrl } = await import('../../../lib/adapters/fileStore')

    expect(createPluginProtocolUrl('layout', 'chunks/page view.js')).toBe(
      'plugin://localhost/layout/chunks/page%20view.js',
    )
    expect(convertFileSrc).toHaveBeenCalledWith('', 'plugin')
  })

  it('rejects traversal paths before creating a URL', async () => {
    const { createPluginProtocolUrl } = await import('../../../lib/adapters/fileStore')

    expect(() => createPluginProtocolUrl('layout', '../outside.js')).toThrow('safe relative path')
  })
})