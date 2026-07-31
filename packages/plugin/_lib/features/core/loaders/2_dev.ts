import type { PluginArchiveDB } from '@delta-comic/db'

import type { PluginConfigFactory } from '@/plugin'

import { PluginLoader } from '../../../driver/extensionTypes'
import { decodeDevMeta } from '../../../driver/init/native'
import { installDevCode, readPluginText } from '../../../driver/init/storage'

export default new (class extends PluginLoader {
  public override name = 'dev'

  public override async install(file: File): Promise<PluginArchiveDB.Meta> {
    const code = await file.text()
    return await installDevCode(code)
  }
  public override canInstall(file: File): boolean {
    return file.name.endsWith('.js')
  }

  public override async load(
    pluginMeta: PluginArchiveDB.Archive,
  ): Promise<PluginConfigFactory | undefined> {
    const code = await readPluginText(pluginMeta.pluginName, 'us.js')
    const lastIndex = code.lastIndexOf(';') + 1

    const blob = new Blob([code.slice(0, lastIndex)], { type: 'text/javascript' })

    const url = URL.createObjectURL(blob)
    try {
      const mod: { default: any } = await import(/* @vite-ignore */ url)
      return mod.default as PluginConfigFactory | undefined
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  public override async decodeMeta(file: File): Promise<PluginArchiveDB.Meta> {
    const code = await file.text()
    return await decodeDevMeta(code)
  }

  public override isMetaFile(file: File): boolean {
    return file.name.endsWith('.js')
  }
  public override async decodeMetaFile(file: File): Promise<PluginArchiveDB.Meta | string> {
    return this.decodeMeta(file)
  }
})()