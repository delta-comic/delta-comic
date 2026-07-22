import { db, type PluginArchiveDB } from '@delta-comic/db'
import type { Raw } from 'vue'
import { shallowReactive, shallowRef } from 'vue'

import { translatePluginText } from '@/i18n'
import type { PluginConfig } from '@/plugin'

export class PluginStore {
  public readonly plugins = shallowReactive(new Map<string, Raw<PluginConfig>>())
  /** Plugins whose complete boot pipeline has completed successfully. */
  public readonly ready = shallowReactive(new Set<string>())
  public readonly revision = shallowRef(0)
  private readonly pluginNames = shallowReactive(new Map<string, string>())

  /**
   * Returns true only when every registered booter has completed successfully.
   *
   * `plugins.has()` intentionally is not used here: the config is inserted before
   * the first booter runs and can therefore describe a partially initialized plugin.
   */
  public $isLoaded(plugin: string) {
    return this.ready.has(plugin)
  }

  /** Starts a new load generation and invalidates the previous readiness state. */
  public $markLoading(plugin: string) {
    this.ready.delete(plugin)
  }

  /** Marks a plugin ready after all booters have completed. */
  public $markReady(plugin: string) {
    this.ready.add(plugin)
  }

  /** Removes all lifecycle state for a plugin. */
  public $markUnloaded(plugin: string) {
    this.ready.delete(plugin)
  }

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