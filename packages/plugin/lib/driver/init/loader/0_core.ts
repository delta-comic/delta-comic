import type { PluginArchiveDB } from '@delta-comic/db'

import type { PluginConfigFactory } from '@/plugin'

import { coreName, getCorePluginConfig } from '../../core'
import { PluginLoader } from '../utils'

export default new class extends PluginLoader {
  public override name = coreName

  public override install(): Promise<PluginArchiveDB.Meta> {
    throw new Error('core 插件不支持安装')
  }
  public override canInstall(): boolean {
    return false
  }
  public override decodeMeta(): Promise<PluginArchiveDB.Meta> {
    throw new Error('core 插件不支持解码')
  }

  public override async load(_meta: PluginArchiveDB.Archive): Promise<PluginConfigFactory | undefined> {
    return getCorePluginConfig()
  }
}
