import type { Kysely } from 'kysely'

async function up(db: Kysely<any>) {
  await db.schema.alterTable('plugin').addColumn('displayName', 'text').execute()
}

async function down(db: Kysely<any>) {
  await db.schema.alterTable('plugin').dropColumn('displayName').execute()
}

export default { up, down }