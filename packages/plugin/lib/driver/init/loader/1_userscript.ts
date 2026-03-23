import type { PluginArchiveDB } from '@delta-comic/db'
import { join } from '@tauri-apps/api/path'
import * as fs from '@tauri-apps/plugin-fs'
import { parse } from 'userscript-meta'

import { decodePluginMeta } from '@/plugin'

import { PluginLoader } from '../utils'
import { getPluginFsPath } from '../utils'

class _PluginUserscriptLoader extends PluginLoader {
  public override name = 'userscript'
  public override async install(file: File): Promise<PluginArchiveDB.Meta> {
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

  public override async load(pluginMeta: PluginArchiveDB.Archive): Promise<any> {
    const code = await fs.readTextFile(
      await join(await getPluginFsPath(pluginMeta.pluginName), 'us.js')
    )
    const lastIndex = code.lastIndexOf(';') + 1

    const blob = new Blob([code.slice(0, lastIndex)], { type: 'text/javascript' })

    const url = URL.createObjectURL(blob)
    const script = document.createElement('script')
    script.addEventListener('load', () => {
      URL.revokeObjectURL(url)
    })
    script.addEventListener('error', err => {
      URL.revokeObjectURL(url)
      throw err
    })
    script.async = true
    script.src = url
    document.body.appendChild(script)
  }
  public override async decodeMeta(file: File): Promise<PluginArchiveDB.Meta> {
    const code = await file.text()
    const meta = decodePluginMeta(parse(code))
    return meta
  }
}

export default new _PluginUserscriptLoader()