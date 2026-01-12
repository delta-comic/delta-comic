import { PluginLoader, type PluginFile } from "../utils"
import * as fs from '@tauri-apps/plugin-fs'
import { getPluginFsPath } from "../utils"
import type { PluginArchiveDB } from "@/plugin/db"
import { type PluginMeta } from "delta-comic-core"
import JSZip from "jszip"


interface ProMeta {
  meta: PluginMeta
}

const jszip = new JSZip()
class _PluginUserscriptLoader extends PluginLoader {
  public override name = 'zip'
  public override async installDownload(file: PluginFile): Promise<PluginMeta> {
    // const path = getPluginFsPath(meta.name.id)
    // await fs.mkdir(path, { recursive: true })
    // await fs.writeTextFile(`${path}/us.js`, code, { create: true })
    const zip = await jszip.loadAsync(file.blob)
    const { meta } = <ProMeta>JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '{}')
    return meta
  }
  public override canInstall(file: PluginFile): boolean {
    return file.fileName.endsWith('.zip')
  }

  public override async load(pluginMeta: PluginArchiveDB.Meta): Promise<any> {
    const code = await fs.readTextFile(getPluginFsPath(pluginMeta.pluginName) + '/us.js')
    const script = document.createElement('script')
    script.innerHTML = code
    document.body.appendChild(script)
  }
}

export default new _PluginUserscriptLoader