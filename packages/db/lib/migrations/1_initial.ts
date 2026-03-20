import type { Kysely } from 'kysely'

async function up(db: Kysely<any>) {
  //#region itemStore begin
  await db.schema
    .createTable('itemStore')
    .addColumn('key', 'text', col => col.primaryKey().notNull())
    .addColumn('item', 'text', col => col.notNull())
    .execute()

  await db.schema.createIndex('item_store_key').on('itemStore').column('key').execute()
  //#endregion

  //#region history begin
  await db.schema
    .createTable('history')
    .addColumn('ep', 'text', col => col.notNull())
    .addColumn('timestamp', 'datetime', col => col.notNull().primaryKey())
    .addColumn('itemKey', 'text', col => col.notNull().unique())
    .addForeignKeyConstraint('itemKeyForeign', ['itemKey'], 'itemStore', ['key'], cb =>
      cb.onDelete('cascade')
    )
    .execute()

  await db.schema.createIndex('history_timestamp').on('history').column('timestamp desc').execute()
  //#endregion

  //#region recentView begin
  await db.schema
    .createTable('recentView')
    .addColumn('timestamp', 'datetime', col => col.notNull().primaryKey())
    .addColumn('itemKey', 'text', col => col.notNull().unique())
    .addForeignKeyConstraint('itemKeyForeign', ['itemKey'], 'itemStore', ['key'], cb =>
      cb.onDelete('cascade')
    )
    .addColumn('isViewed', 'boolean', col => col.notNull())
    .execute()

  await db.schema
    .createIndex('recent_timestamp')
    .on('recentView')
    .column('timestamp desc')
    .execute()
  //#endregion

  //#region favouriteCard begin
  await db.schema
    .createTable('favouriteCard')
    .addColumn('createAt', 'datetime', col => col.notNull().primaryKey())
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('private', 'boolean', col => col.notNull())
    .addColumn('description', 'text', col => col.notNull())
    .execute()
  await db
    .insertInto('favouriteCard')
    .values({ createAt: 0, title: '默认收藏夹', private: false, description: '' })
    .execute()

  await db.schema
    .createIndex('favourite_card_title_createAt')
    .on('favouriteCard')
    .column('createAt desc')
    .column('title')
    .execute()
  //#endregion

  //#region favouriteItem begin
  await db.schema
    .createTable('favouriteItem')
    .addColumn('addTime', 'datetime', col => col.notNull())
    .addColumn('belongTo', 'integer', col => col.notNull())
    .addColumn('itemKey', 'text', col => col.notNull())
    .addPrimaryKeyConstraint('primary_key', ['addTime', 'belongTo', 'itemKey'])
    .addUniqueConstraint('uniqueKey', ['belongTo', 'itemKey'])
    .addForeignKeyConstraint('itemKeyForeign', ['itemKey'], 'itemStore', ['createAt'], cb =>
      cb.onDelete('cascade')
    )
    .addForeignKeyConstraint('belongToForeign', ['belongTo'], 'favouriteCard', ['key'], cb =>
      cb.onDelete('cascade')
    )
    .execute()

  await db.schema
    .createIndex('favourite_item_belongTo_addTime')
    .on('favouriteItem')
    .column('addTime desc')
    .column('belongTo')
    .execute()
  //#endregion

  //#region subscribe begin
  await db.schema
    .createTable('subscribe')
    .addColumn('itemKey', 'text')
    .addForeignKeyConstraint('itemKeyForeign', ['itemKey'], 'itemStore', ['key'], cb =>
      cb.onDelete('cascade')
    )
    .addColumn('author', 'text')
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('key', 'text', col => col.notNull())
    .addColumn('plugin', 'text', col => col.notNull())
    .addPrimaryKeyConstraint('primary_key', ['plugin', 'key'])
    .execute()

  await db.schema
    .createIndex('subscribe_key_plugin')
    .on('subscribe')
    .column('key')
    .column('plugin')
    .execute()
  //#endregion

  //#region plugin begin
  await db.schema
    .createTable('plugin')
    .addColumn('installerName', 'text', col => col.notNull())
    .addColumn('loaderName', 'text', col => col.notNull())
    .addColumn('pluginName', 'text', col => col.notNull().primaryKey())
    .addColumn('meta', 'json', col => col.notNull())
    .addColumn('enable', 'text', col => col.notNull())
    .addColumn('installInput', 'text', col => col.notNull())
    .execute()

  await db.schema.createIndex('plugin_enable').on('plugin').column('enable').execute()

  await db.schema.createIndex('plugin_pluginName').on('plugin').column('pluginName').execute()
  //#endregion
}

async function down(db: Kysely<any>) {
  await db.schema.dropTable('itemStore').ifExists().execute()
  await db.schema.dropTable('history').ifExists().execute()
  await db.schema.dropTable('recentView').ifExists().execute()
  await db.schema.dropTable('favouriteCard').ifExists().execute()
  await db.schema.dropTable('favouriteItem').ifExists().execute()
  await db.schema.dropTable('subscribe').ifExists().execute()
  await db.schema.dropTable('plugin').ifExists().execute()
}

export default { up, down }