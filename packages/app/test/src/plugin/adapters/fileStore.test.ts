import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const convertFileSrc = vi.fn(() => 'plugin://localhost/')
const appLocalDataDir = vi.fn(async () => '/app/local-data')
const join = vi.fn(async (...parts: string[]) => parts.join('/'))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc, isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({ appLocalDataDir, join }))

describe('plugin protocol URLs', () => {
  beforeEach(() => convertFileSrc.mockClear())

  it('preserves path segments for relative module resolution', async () => {
    const { createPluginProtocolUrl } = await import('../../../../src/plugin/adapters/fileStore')

    expect(createPluginProtocolUrl('layout', 'chunks/page view.js')).toBe(
      'plugin://localhost/layout/chunks/page%20view.js',
    )
    expect(convertFileSrc).toHaveBeenCalledWith('', 'plugin')
  })

  it('rejects traversal paths before creating a URL', async () => {
    const { createPluginProtocolUrl } = await import('../../../../src/plugin/adapters/fileStore')

    expect(() => createPluginProtocolUrl('layout', '../outside.js')).toThrow('safe relative path')
  })
})

describe('Tauri plugin roots', () => {
  it('uses the same app-local plugin root as the filesystem backend', async () => {
    const { getTauriPluginRoot } = await import('../../../../src/plugin/adapters/fileStore')

    await expect(getTauriPluginRoot('reader')).resolves.toBe('/app/local-data/plugin/reader')
    expect(appLocalDataDir).toHaveBeenCalledOnce()
    expect(join).toHaveBeenCalledWith('/app/local-data', 'plugin', 'reader')
  })
})

it('collects abandoned revisions after restart and preserves legacy files', async () => {
  const { AtomicPluginFileStore } = await import('../../../../src/plugin/adapters/fileStore')
  const live = '_demo.' + '1'.repeat(64)
  const abandoned = '_demo.' + '2'.repeat(64)
  const backend = {
    keys: async () => [live, abandoned, 'demo'],
    replace: vi.fn(),
    read: vi.fn(),
    snapshot: vi.fn(),
  }
  await new AtomicPluginFileStore(backend).collectRevisions(new Set([live]))
  expect(backend.replace.mock.calls).toEqual([[abandoned, new Map()]])
})