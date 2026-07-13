import type { PluginArchiveDB } from '@delta-comic/db'
import JSZip from 'jszip'

import { pluginI18n } from '@/i18n'
import type { PluginConfigFactory } from '@/plugin'

import { PluginLoader, type PluginLoaderInstallContext } from '../../../driver/extensionTypes'
import {
  createPluginAssetUrl,
  createPluginModuleUrl,
  installZipFile,
  isTauriRuntime,
  listPluginFiles,
  readPluginText,
} from '../../../driver/init/storage'

export const rewriteCssAssetUrls = async (
  cssPath: string,
  css: string,
  createAssetUrl: (path: string) => Promise<string>,
) => {
  const pattern = /url\(\s*(?:(["'])(.*?)\1|([^)'"\s][^)]*?))\s*\)/g
  let output = ''
  let cursor = 0
  for (const match of css.matchAll(pattern)) {
    const index = match.index
    const rawUrl = (match[2] ?? match[3] ?? '').trim()
    if (!rawUrl || /^(?:#|blob:|data:|https?:|\/\/)/i.test(rawUrl)) continue
    const resolved = new URL(rawUrl, `https://plugin.local/${cssPath}`)
    const assetUrl = await createAssetUrl(resolved.pathname.slice(1))
    output += css.slice(cursor, index) + `url("${assetUrl}${resolved.search}${resolved.hash}")`
    cursor = index + match[0].length
  }
  return output + css.slice(cursor)
}

export default new (class extends PluginLoader {
  public override name = 'zip'
  public override async install(
    file: File,
    context?: PluginLoaderInstallContext,
  ): Promise<PluginArchiveDB.Meta> {
    console.log('[loader zip] begin:', file)
    return await installZipFile(file, progress => {
      const percent = progress.total > 0 ? (progress.current / progress.total) * 90 : 0
      context?.report({
        description: progress.path
          ? pluginI18n.translate('plugin.progress.extractingPath', { path: progress.path })
          : pluginI18n.translate('plugin.progress.extracting'),
        progress: percent,
      })
    })
  }
  public override canInstall(file: File): boolean {
    return file.name.endsWith('.zip')
  }

  public override async load(
    pluginMeta: PluginArchiveDB.Archive,
  ): Promise<PluginConfigFactory | undefined> {
    if (!pluginMeta.meta.entry) throw new Error('not found entry')
    const files = await listPluginFiles(pluginMeta.pluginName)
    const javascriptFiles = files.filter(path => /\.(?:js|mjs)$/i.test(path))
    if (!isTauriRuntime() && javascriptFiles.length > 1) {
      throw new Error(
        pluginI18n.translate('plugin.install.errors.webSingleFile', {
          files: javascriptFiles.join(', '),
        }),
      )
    }
    const src = await createPluginModuleUrl(pluginMeta.pluginName, pluginMeta.meta.entry.jsPath)
    const config = await import(/* @vite-ignore */ src).finally(() => {
      if (src.startsWith('blob:')) URL.revokeObjectURL(src)
    })
    const result = config.default as PluginConfigFactory | undefined

    if (!pluginMeta.meta.entry?.cssPath) return result
    const cssPath = pluginMeta.meta.entry.cssPath

    if (cssPath == 'auto') {
      const discovered = files.find(path => path.endsWith('.css'))
      if (!discovered) return result
      var filePath = discovered
    } else var filePath = cssPath

    const style = document.createElement('style')
    style.dataset.plugin = pluginMeta.pluginName
    style.textContent = await rewriteCssAssetUrls(
      filePath,
      await readPluginText(pluginMeta.pluginName, filePath),
      path => createPluginAssetUrl(pluginMeta.pluginName, path),
    )
    document.head.appendChild(style)

    return result
  }
  public override async decodeMeta(file: File): Promise<PluginArchiveDB.Meta> {
    const zip = await JSZip.loadAsync(file)
    const manifest = zip.file('manifest.json')
    if (!manifest) throw new Error('plugin archive does not contain manifest.json')
    return JSON.parse(await manifest.async('text')) as PluginArchiveDB.Meta
  }

  public override isMetaFile(file: File): boolean {
    return file.name.endsWith('.zip') || file.name == 'manifest.json'
  }
  public override async decodeMetaFile(file: File): Promise<PluginArchiveDB.Meta | string> {
    if (file.name == 'manifest.json') return JSON.parse(await file.text())
    const jszip = new JSZip()
    const zip = await jszip.loadAsync(file)
    const mFile = await zip.filter(p => p == 'manifest.json')[0].async('text')
    return JSON.parse(mFile)
  }
})()