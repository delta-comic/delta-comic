import type { PluginArchiveDB } from '@delta-comic/db'
import { join } from '@tauri-apps/api/path'
import * as fs from '@tauri-apps/plugin-fs'

import type { PluginConfigFactory } from '@/plugin'

import { PluginLoader } from '../utils'
import { getPluginFsPath } from '../utils'

export default new (class extends PluginLoader {
  public override name = 'dev'

  public decodeMetaFromCode(code: string) {
    const key = '@description'
    const beginPos = code.indexOf(key) + key.length + 1
    return JSON.parse(
      code.slice(beginPos, code.indexOf('\n// @', beginPos)),
    ) as PluginArchiveDB.Meta
  }

  public override async install(file: File): Promise<PluginArchiveDB.Meta> {
    const code = await file.text()
    const meta = this.decodeMetaFromCode(code)
    const path = await getPluginFsPath(meta.name.id)
    await fs.mkdir(path, { recursive: true })
    await fs.writeTextFile(await join(path, 'us.js'), code, { create: true })
    return meta
  }
  public override canInstall(file: File): boolean {
    return file.name.endsWith('.js')
  }

  public override async load(
    pluginMeta: PluginArchiveDB.Archive,
  ): Promise<PluginConfigFactory | undefined> {
    const code = await fs.readTextFile(
      await join(await getPluginFsPath(pluginMeta.pluginName), 'us.js'),
    )
    const lastIndex = code.lastIndexOf(';') + 1

    const blob = new Blob([code.slice(0, lastIndex)], { type: 'text/javascript' })

    const url = URL.createObjectURL(blob)
    const mod: { default: any } = await import(/* @vite-ignore */ url)
    return mod.default as PluginConfigFactory | undefined
  }
  public override async decodeMeta(file: File): Promise<PluginArchiveDB.Meta> {
    const code = await file.text()
    const meta = this.decodeMetaFromCode(code)
    return meta
  }
})()