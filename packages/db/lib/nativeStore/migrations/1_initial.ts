import type { Kysely } from 'kysely'

async function up(db: Kysely<any>) {
  await db.schema
    .createTable('store')
    .addColumn('item', 'text', col => col.notNull()) // json
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('namespace', 'text', col => col.notNull())
    .addPrimaryKeyConstraint('key', ['name', 'namespace'])
    .execute()
}

async function down(db: Kysely<any>) {
  await db.schema.dropTable('store').ifExists().execute()
}

export default { up, down }