import { PluginLoader, type PluginFile } from "../utils"
import * as fs from '@tauri-apps/plugin-fs'
import { getPluginFsPath } from "../utils"
import type { PluginArchiveDB } from "@/plugin/db"
import { type PluginMeta } from "delta-comic-core"
import { loadAsync, type JSZipObject } from "jszip"



class _PluginUserscriptLoader extends PluginLoader {
  public override name = 'zip'
  public override async installDownload(file: PluginFile): Promise<PluginMeta> {
    const zip = await loadAsync(file.blob)
    const meta = <PluginMeta>JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '{}')
    const root = getPluginFsPath(meta.name.id)
    await fs.mkdir(root, { recursive: true })
    const files = new Array<{
      path: string
      file: JSZipObject
    }>()
    zip.forEach((zipFilePath, file) => {
      files.push({
        path: zipFilePath,
        file
      })
    })
    for (const { file, path } of files) {
      if (file.dir)
        await fs.mkdir(`${root}/${path}`, { recursive: true })
      else
        await fs.writeFile(`${root}/${path}`, await file.async('uint8array'), { create: true })
    }
    return meta
  }
  public override canInstall(file: PluginFile): boolean {
    return file.fileName.endsWith('.zip')
  }

  public override async load(pluginMeta: PluginArchiveDB.Meta): Promise<any> {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = `http://local.localhost/${getPluginFsPath(pluginMeta.pluginName)}/index.js`
    document.body.appendChild(script)

    const style = document.createElement('link')
    style.rel = 'stylesheet'
    style.href = `http://local.localhost/${getPluginFsPath(pluginMeta.pluginName)}/index.css`
    document.head.appendChild(style)
  }
}

export default new _PluginUserscriptLoader