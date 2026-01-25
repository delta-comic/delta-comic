import { PluginLoader, type PluginFile } from "../utils"
import * as fs from '@tauri-apps/plugin-fs'
import { getPluginFsPath } from "../utils"
import type { PluginArchiveDB } from "@/plugin/db"
import { decodePluginMeta, type PluginMeta } from "delta-comic-core"
import { parse } from "userscript-meta"
import { join } from "@tauri-apps/api/path"

class _PluginUserscriptLoader extends PluginLoader {
  public override name = 'userscript'
  public override async installDownload(file: PluginFile): Promise<PluginMeta> {
    const code = await file.blob.text()
    const meta = decodePluginMeta(parse(code))
    const path = await getPluginFsPath(meta.name.id)
    await fs.mkdir(path, { recursive: true })
    await fs.writeTextFile(await join(path, 'us.js'), code, { create: true })
    return meta
  }
  public override canInstall(file: PluginFile): boolean {
    return file.fileName.endsWith('.js')
  }

  public override async load(pluginMeta: PluginArchiveDB.Meta): Promise<any> {
    const code = await fs.readFile(await join(await getPluginFsPath(pluginMeta.pluginName), 'us.js'))
    const script = document.createElement('script')
    const url = URL.createObjectURL(new Blob([code]))
    script.async = true
    script.src = url
    script.onerror = (err) => { throw err }
    document.body.appendChild(script)
  }
}

export default new _PluginUserscriptLoader