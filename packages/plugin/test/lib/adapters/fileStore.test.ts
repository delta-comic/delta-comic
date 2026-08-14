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

describe('module URL versioning', () => {
  it('busts the module cache after every file replacement and removal', async () => {
    const { AtomicPluginFileStore } = await import('../../../lib/adapters/fileStore')
    const backend = {
      moduleUrl: vi.fn(async () => 'plugin://localhost/demo/index.mjs'),
      read: vi.fn(),
      replace: vi.fn(async () => undefined),
      snapshot: vi.fn(async () => new Map<string, Uint8Array>()),
    }
    const store = new AtomicPluginFileStore(backend)

    await expect(store.createModuleUrl('demo', 'index.mjs')).resolves.toBe(
      'plugin://localhost/demo/index.mjs?v=0',
    )
    await store.replace('demo', new Map())
    await expect(store.createModuleUrl('demo', 'index.mjs')).resolves.toBe(
      'plugin://localhost/demo/index.mjs?v=1',
    )
    await store.remove('demo')
    await store.replace('demo', new Map())
    await expect(store.createModuleUrl('demo', 'index.mjs')).resolves.toBe(
      'plugin://localhost/demo/index.mjs?v=3',
    )
  })
})