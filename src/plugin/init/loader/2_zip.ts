import { convertFileSrc } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import * as fs from '@tauri-apps/plugin-fs'
import { type PluginMeta } from 'delta-comic-core'
import { loadAsync, type JSZipObject } from 'jszip'

import type { PluginArchiveDB } from '@/plugin/db'

import { PluginLoader } from '../utils'
import { getPluginFsPath } from '../utils'

class _PluginUserscriptLoader extends PluginLoader {
  public override name = 'zip'
  public override async installDownload(file: File): Promise<PluginMeta> {
    console.log('[loader zip] begin:', file)
    const temp = await getPluginFsPath('__temp__')
    await fs.mkdir(temp, { recursive: true })
    await fs.writeFile(await join(temp, 'temp.zip'), new Uint8Array(await file.arrayBuffer()))
    console.log('[loader zip] temp:', temp)
    const zip = await loadAsync(file)
    console.log(zip.files)
    const meta = <PluginMeta>JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '{}')
    const root = await getPluginFsPath(meta.name.id)
    try {
      await fs.remove(root, { recursive: true })
    } catch {}
    await fs.mkdir(root, { recursive: true })
    const files = new Array<{ path: string; file: JSZipObject }>()
    zip.forEach((zipFilePath, file) => {
      files.push({ path: zipFilePath, file })
    })
    for (const { file, path } of files) {
      if (file.dir) await fs.mkdir(await join(root, path), { recursive: true })
      else
        await fs.writeFile(await join(root, path), await file.async('uint8array'), { create: true })
    }
    return meta
  }
  public override canInstall(file: File): boolean {
    return file.name.endsWith('.zip')
  }

  public override async load(pluginMeta: PluginArchiveDB.Meta): Promise<any> {
    if (!pluginMeta.meta.entry) throw new Error('not found entry')
    const baseDir = await getPluginFsPath(pluginMeta.pluginName)
    console.log('[loader zip] baseDir:', baseDir, pluginMeta.meta.entry)
    const script = document.createElement('script')
    script.addEventListener('error', err => {
      throw err
    })
    script.type = 'module'
    script.async = true
    script.src = decodeURIComponent(
      convertFileSrc(await join(baseDir, pluginMeta.meta.entry.jsPath), 'local')
    )
    document.body.appendChild(script)

    if (!pluginMeta.meta.entry?.cssPath) return
    const cssPath = pluginMeta.meta.entry.cssPath

    if (cssPath == 'auto') {
      var filePath = ''
      // take first
      const files = await fs.readDir(baseDir)
      for (const file of files) {
        if (file.name.endsWith('.css')) {
          var filePath = file.name
          break
        }
      }
    } else var filePath = cssPath

    const style = document.createElement('link')
    style.addEventListener('error', err => {
      throw err
    })
    style.rel = 'stylesheet'
    style.href = decodeURIComponent(convertFileSrc(await join(baseDir, filePath), 'local'))
    document.head.appendChild(style)
  }
}

export default new _PluginUserscriptLoader()