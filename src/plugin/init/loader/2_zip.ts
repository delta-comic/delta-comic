import { PluginLoader, type PluginFile } from "../utils"
import * as fs from '@tauri-apps/plugin-fs'
import { getPluginFsPath } from "../utils"
import type { PluginArchiveDB } from "@/plugin/db"
import { type PluginMeta } from "delta-comic-core"
import { loadAsync, type JSZipObject } from "jszip"



class _PluginUserscriptLoader extends PluginLoader {
  public override name = 'zip'
  public override async installDownload(file: PluginFile): Promise<PluginMeta> {
    console.log(file)
    const zip = await loadAsync(file.blob)
    console.log(zip.files)
    const meta = <PluginMeta>JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '{}')
    const root = getPluginFsPath(meta.name.id)
    await fs.remove(root, { recursive: true })
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
    const baseDir = `http://local.localhost/${getPluginFsPath(pluginMeta.pluginName)}`

    const script = document.createElement('script')
    script.type = 'module'
    script.src = `${baseDir}/${pluginMeta.meta.entry!.jsPath}`
    document.body.appendChild(script)

    if (!pluginMeta.meta.entry?.cssPath) return
    const style = document.createElement('link')
    style.rel = 'stylesheet'
    style.href = `${baseDir}/${pluginMeta.meta.entry.cssPath}`
    document.head.appendChild(style)
  }
}

export default new _PluginUserscriptLoader