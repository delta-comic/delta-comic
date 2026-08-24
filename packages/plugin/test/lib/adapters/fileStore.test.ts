import { beforeEach, describe, expect, it, vi } from 'vitest'

const convertFileSrc = vi.fn(() => 'plugin://localhost/')
const appLocalDataDir = vi.fn(async () => '/app/local-data')
const join = vi.fn(async (...parts: string[]) => parts.join('/'))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc, isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({ appLocalDataDir, join }))

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

describe('Tauri plugin roots', () => {
  it('uses the same app-local plugin root as the filesystem backend', async () => {
    const { getTauriPluginRoot } = await import('../../../lib/adapters/fileStore')

    await expect(getTauriPluginRoot('reader')).resolves.toBe('/app/local-data/plugin/reader')
    expect(appLocalDataDir).toHaveBeenCalledOnce()
    expect(join).toHaveBeenCalledWith('/app/local-data', 'plugin', 'reader')
  })
})

describe('module URL versioning', () => {
  it('busts the module cache after every file replacement and removal', async () => {
    const { AtomicPluginFileStore } = await import('../../../lib/adapters/fileStore')
    const backend = {
      moduleUrl: vi.fn(async () => 'plugin://localhost/demo/index.js'),
      read: vi.fn(),
      replace: vi.fn(async () => undefined),
      snapshot: vi.fn(async () => new Map<string, Uint8Array>()),
    }
    const store = new AtomicPluginFileStore(backend)

    await expect(store.createModuleUrl('demo', 'index.js')).resolves.toBe(
      'plugin://localhost/demo/index.js?v=0',
    )
    await store.replace('demo', new Map())
    await expect(store.createModuleUrl('demo', 'index.js')).resolves.toBe(
      'plugin://localhost/demo/index.js?v=1',
    )
    await store.remove('demo')
    await store.replace('demo', new Map())
    await expect(store.createModuleUrl('demo', 'index.js')).resolves.toBe(
      'plugin://localhost/demo/index.js?v=3',
    )
  })
})