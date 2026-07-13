import { db, type PluginArchiveDB } from '@delta-comic/db'
import type { Raw } from 'vue'
import { shallowReactive, shallowRef } from 'vue'

import { translatePluginText } from '@/i18n'
import type { PluginConfig } from '@/plugin'

export class PluginStore {
  public readonly plugins = shallowReactive(new Map<string, Raw<PluginConfig>>())
  public readonly revision = shallowRef(0)
  private readonly pluginNames = shallowReactive(new Map<string, string>())

  public async $refreshI18nNames() {
    const names = await db.selectFrom('plugin').select(['pluginName', 'displayName']).execute()
    this.pluginNames.clear()
    for (const plugin of names) this.pluginNames.set(plugin.pluginName, plugin.displayName)
  }

  public $getI18nName(key: string) {
    return translatePluginText(this.pluginNames.get(key) || key)
  }

  public async $upsertArchives(archives: PluginArchiveDB.Archive[]) {
    if (archives.length === 0) return
    await db
      .replaceInto('plugin')
      .values(archives.map(archive => ({ ...archive, meta: JSON.stringify(archive.meta) })))
      .execute()
    await this.$refreshI18nNames()
    this.$touch()
  }

  public $touch() {
    this.revision.value++
  }
}

export const pluginStore = new PluginStore()
export const usePluginStore = () => pluginStore