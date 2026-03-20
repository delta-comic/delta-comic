import type { Kysely } from 'kysely'

async function up(db: Kysely<any>) {
  //#region favouriteItem begin
  await db.schema.alterTable('favouriteItem').renameTo('favouriteItem_old').execute()

  await db.schema
    .createTable('favouriteItem')
    .addColumn('addTime', 'datetime', col => col.notNull())
    .addColumn('belongTo', 'integer', col => col.notNull())
    .addColumn('itemKey', 'text', col => col.notNull())
    .addPrimaryKeyConstraint('primary_key', ['addTime', 'belongTo', 'itemKey'])
    .addUniqueConstraint('uniqueKey', ['belongTo', 'itemKey'])
    .addForeignKeyConstraint('itemKeyForeign', ['itemKey'], 'itemStore', ['key'], cb =>
      cb.onDelete('cascade')
    )
    .addForeignKeyConstraint('belongToForeign', ['belongTo'], 'favouriteCard', ['createAt'], cb =>
      cb.onDelete('cascade')
    )
    .execute()

  await db
    .insertInto('favouriteItem')
    .columns(['addTime', 'belongTo', 'itemKey'])
    .expression(eb => eb.selectFrom('favouriteItem_old').select(['addTime', 'belongTo', 'itemKey']))
    .execute()

  // 4️⃣ 删除旧表
  await db.schema.dropTable('favouriteItem_old').execute()

  await db.schema
    .createIndex('favourite_item_belongTo_addTime')
    .on('favouriteItem')
    .column('addTime desc')
    .column('belongTo')
    .execute()
  //#endregion
}

async function down(db: Kysely<any>) {
  await db.schema.alterTable('favouriteItem').renameTo('favouriteItem_new').execute()

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

  await db
    .insertInto('favouriteItem')
    .columns(['addTime', 'belongTo', 'itemKey'])
    .expression(eb => eb.selectFrom('favouriteItem_new').select(['addTime', 'belongTo', 'itemKey']))
    .execute()

  await db.schema.dropTable('favouriteItem_new').execute()

  await db.schema
    .createIndex('favourite_item_belongTo_addTime')
    .on('favouriteItem')
    .column('addTime desc')
    .column('belongTo')
    .execute()
}

export default { up, down }