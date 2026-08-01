import { db, type PluginArchiveDB } from '@delta-comic/db'

import type { PluginArchiveRepository } from './contracts'

export class DatabasePluginArchiveRepository implements PluginArchiveRepository {
  public async find(plugin: string) {
    return await db
      .selectFrom('plugin')
      .selectAll()
      .where('pluginName', '=', plugin)
      .executeTakeFirst()
  }

  public async list() {
    return await db.selectFrom('plugin').selectAll().execute()
  }

  public async remove(plugin: string) {
    await db.deleteFrom('plugin').where('pluginName', '=', plugin).execute()
  }

  public async upsert(archive: PluginArchiveDB.Archive) {
    await db
      .replaceInto('plugin')
      .values({ ...archive, meta: JSON.stringify(archive.meta) })
      .execute()
  }
}