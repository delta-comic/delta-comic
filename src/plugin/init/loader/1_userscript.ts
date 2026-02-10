import { join } from '@tauri-apps/api/path'
import * as fs from '@tauri-apps/plugin-fs'
import { decodePluginMeta, type PluginMeta } from 'delta-comic-core'
import { parse } from 'userscript-meta'

import type { PluginArchiveDB } from '@/plugin/db'

import { PluginLoader } from '../utils'
import { getPluginFsPath } from '../utils'

class _PluginUserscriptLoader extends PluginLoader {
  public override name = 'userscript'
  public override async installDownload(file: File): Promise<PluginMeta> {
    const code = await file.text()
    const meta = decodePluginMeta(parse(code))
    const path = await getPluginFsPath(meta.name.id)
    await fs.mkdir(path, { recursive: true })
    await fs.writeTextFile(await join(path, 'us.js'), code, { create: true })
    return meta
  }
  public override canInstall(file: File): boolean {
    return file.name.endsWith('.js')
  }

  public override async load(pluginMeta: PluginArchiveDB.Meta): Promise<any> {
    const code = await fs.readFile(
      await join(await getPluginFsPath(pluginMeta.pluginName), 'us.js')
    )
    const script = document.createElement('script')
    script.addEventListener('error', err => {
      throw err
    })
    const url = URL.createObjectURL(new Blob([code]))
    script.async = true
    script.src = url
    document.body.appendChild(script)
  }
}

export default new _PluginUserscriptLoader()