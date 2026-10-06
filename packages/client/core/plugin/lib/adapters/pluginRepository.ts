import type { PluginArchiveRepository } from '@delta-comic/client-core-plugin-install'
import {
  assertWriteRow,
  db,
  validateReadRow,
  type PluginArchiveDB,
} from '@delta-comic/client-data-db'

export class DatabasePluginArchiveRepository implements PluginArchiveRepository {
  public async find(plugin: string) {
    const row = await db
      .selectFrom('plugin')
      .selectAll()
      .where('pluginName', '=', plugin)
      .executeTakeFirst()
    return row ? validateReadRow('plugin', row) : undefined
  }

  public async list() {
    const rows = await db.selectFrom('plugin').selectAll().execute()
    return rows.map(row => validateReadRow('plugin', row))
  }

  public async remove(plugin: string) {
    await db.deleteFrom('plugin').where('pluginName', '=', plugin).execute()
  }

  public async upsert(archive: PluginArchiveDB.Archive) {
    const row = assertWriteRow('plugin', {
      ...archive,
      meta: JSON.stringify(archive.meta),
      config: JSON.stringify(archive.config ?? {}),
    })
    await db.replaceInto('plugin').values(row).execute()
  }
}