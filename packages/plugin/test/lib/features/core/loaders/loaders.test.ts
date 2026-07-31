import JSZip from 'jszip'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  createPluginAssetUrl: vi.fn(async (_plugin: string, path: string) => `blob:asset/${path}`),
  createPluginModuleUrl: vi.fn(
    async () => 'data:text/javascript,export default () => ({ name: "fixture" })',
  ),
  decodeDevMeta: vi.fn(async () => ({ name: { id: 'fixture' } })),
  installDevCode: vi.fn(async () => ({ name: { id: 'fixture' } })),
  installZipFile: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  files: [] as string[],
  readPluginText: vi.fn(async () => ''),
}))

vi.mock('@/i18n', () => ({
  pluginI18n: {
    translate: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  },
}))
vi.mock('../../../../../lib/driver/init/native', () => ({ decodeDevMeta: mocks.decodeDevMeta }))
vi.mock('../../../../../lib/driver/init/storage', () => ({
  createPluginAssetUrl: mocks.createPluginAssetUrl,
  createPluginModuleUrl: mocks.createPluginModuleUrl,
  installDevCode: mocks.installDevCode,
  installZipFile: mocks.installZipFile,
  isTauriRuntime: mocks.isTauriRuntime,
  listPluginFiles: vi.fn(async () => mocks.files),
  readPluginText: mocks.readPluginText,
}))

import zipLoader from '../../../../../lib/features/core/loaders/1_zip'
import devLoader from '../../../../../lib/features/core/loaders/2_dev'

const archive = (entry?: { cssPath?: string; jsPath: string }) =>
  ({ meta: { entry }, pluginName: 'fixture' }) as never

const zipFile = async (entries: Record<string, string>, name = 'fixture.zip') => {
  const zip = new JSZip()
  for (const [path, value] of Object.entries(entries)) zip.file(path, value)
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  Object.defineProperty(bytes, 'name', { value: name })
  return bytes as unknown as File
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.files = []
  mocks.isTauriRuntime.mockReturnValue(false)
  mocks.createPluginModuleUrl.mockResolvedValue(
    'data:text/javascript,export default () => ({ name: "fixture" })',
  )
  mocks.readPluginText.mockResolvedValue('')
})

describe('zip plugin loader', () => {
  it('reports extraction progress and recognizes installable archives', async () => {
    const meta = { name: { id: 'fixture' } }
    mocks.installZipFile.mockImplementationOnce(async (_file, progress) => {
      progress({ current: 1, path: 'index.mjs', total: 2 })
      progress({ current: 0, total: 0 })
      return meta
    })
    const report = vi.fn()
    const file = new File([], 'fixture.zip')

    await expect(zipLoader.install(file, { report })).resolves.toBe(meta)

    expect(zipLoader.canInstall(file)).toBe(true)
    expect(zipLoader.canInstall(new File([], 'fixture.js'))).toBe(false)
    expect(report).toHaveBeenNthCalledWith(1, {
      description: 'plugin.progress.extractingPath:index.mjs',
      progress: 45,
    })
    expect(report).toHaveBeenNthCalledWith(2, {
      description: 'plugin.progress.extracting',
      progress: 0,
    })
  })

  it('requires an entry and rejects multi-module web plugins', async () => {
    await expect(zipLoader.load(archive())).rejects.toThrow('not found entry')

    mocks.files = ['index.mjs', 'chunk.js']
    await expect(zipLoader.load(archive({ jsPath: 'index.mjs' }))).rejects.toThrow(
      'plugin.install.errors.webSingleFile:index.mjs, chunk.js',
    )
  })

  it('loads a single-module config and revokes temporary module URLs', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mocks.files = ['index.mjs']
    mocks.createPluginModuleUrl.mockResolvedValueOnce(
      'data:text/javascript,export default () => ({ name: "fixture" })',
    )

    const factory = await zipLoader.load(archive({ jsPath: 'index.mjs' }))

    expect(factory?.({ platform: 'web', safe: true })).toEqual({ name: 'fixture' })
    expect(revoke).not.toHaveBeenCalled()
  })

  it('allows native multi-module plugins and injects rewritten CSS with ownership metadata', async () => {
    const style = { dataset: {} as Record<string, string>, textContent: '' }
    const appendChild = vi.fn()
    vi.stubGlobal('document', { createElement: vi.fn(() => style), head: { appendChild } })
    mocks.isTauriRuntime.mockReturnValue(true)
    mocks.files = ['index.mjs', 'chunk.js', 'styles/main.css']
    mocks.readPluginText.mockResolvedValueOnce('.cover{background:url(../cover.png)}')

    await zipLoader.load(archive({ cssPath: 'auto', jsPath: 'index.mjs' }))

    expect(style.dataset.plugin).toBe('fixture')
    expect(style.textContent).toBe('.cover{background:url("blob:asset/cover.png")}')
    expect(mocks.createPluginAssetUrl).toHaveBeenCalledWith('fixture', 'cover.png')
    expect(appendChild).toHaveBeenCalledWith(style)
  })

  it('returns the config without adding a style when auto discovery finds no CSS', async () => {
    const createElement = vi.fn()
    vi.stubGlobal('document', { createElement, head: { appendChild: vi.fn() } })
    mocks.files = ['index.mjs']

    await expect(
      zipLoader.load(archive({ cssPath: 'auto', jsPath: 'index.mjs' })),
    ).resolves.toBeTypeOf('function')
    expect(createElement).not.toHaveBeenCalled()
  })

  it('decodes standalone and archived manifests and reports missing manifests', async () => {
    const manifest = { name: { id: 'fixture' }, require: [] }
    const manifestFile = new File([JSON.stringify(manifest)], 'manifest.json')
    const archiveFile = await zipFile({ 'manifest.json': JSON.stringify(manifest) })

    await expect(zipLoader.decodeMeta(archiveFile)).resolves.toEqual(manifest)
    await expect(zipLoader.decodeMetaFile(manifestFile)).resolves.toEqual(manifest)
    await expect(zipLoader.decodeMetaFile(archiveFile)).resolves.toEqual(manifest)
    await expect(
      zipLoader.decodeMeta(await zipFile({ 'index.mjs': 'export default {}' })),
    ).rejects.toThrow('does not contain manifest.json')
    expect(zipLoader.isMetaFile(manifestFile)).toBe(true)
    expect(zipLoader.isMetaFile(archiveFile)).toBe(true)
    expect(zipLoader.isMetaFile(new File([], 'index.mjs'))).toBe(false)
  })
})

describe('development plugin loader', () => {
  it('installs and decodes userscript files', async () => {
    const file = new File(['source code'], 'fixture.js')

    await expect(devLoader.install(file)).resolves.toMatchObject({ name: { id: 'fixture' } })
    await expect(devLoader.decodeMeta(file)).resolves.toMatchObject({ name: { id: 'fixture' } })
    await expect(devLoader.decodeMetaFile(file)).resolves.toMatchObject({ name: { id: 'fixture' } })

    expect(mocks.installDevCode).toHaveBeenCalledWith('source code')
    expect(mocks.decodeDevMeta).toHaveBeenCalledWith('source code')
    expect(devLoader.canInstall(file)).toBe(true)
    expect(devLoader.canInstall(new File([], 'fixture.zip'))).toBe(false)
    expect(devLoader.isMetaFile(file)).toBe(true)
  })

  it('loads only the executable prefix and revokes its object URL', async () => {
    mocks.readPluginText.mockResolvedValueOnce(
      'export default () => ({ name: "fixture" }); trailing invalid source',
    )
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('data:text/javascript,export default () => ({ name: "fixture" })')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const factory = await devLoader.load(archive())

    expect(factory?.({ platform: 'web', safe: true })).toEqual({ name: 'fixture' })
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(revokeObjectURL).toHaveBeenCalledOnce()
  })
})