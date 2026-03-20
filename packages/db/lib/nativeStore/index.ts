import { SourcedValue } from '@delta-comic/model'
import { useGlobalVar } from '@delta-comic/utils'
import Database from '@tauri-apps/plugin-sql'
import { useLocalStorage } from '@vueuse/core'
import { debounce } from 'es-toolkit'
import { CamelCasePlugin, Kysely, Migrator, type GeneratedAlways, type Migration } from 'kysely'
import { TauriSqliteDialect } from 'kysely-dialect-tauri'
import { SerializePlugin } from 'kysely-plugin-serialize'
import mitt from 'mitt'
import { shallowRef, toValue, triggerRef, type MaybeRefOrGetter } from 'vue'

const migrations = import.meta.glob<Migration>('./migrations/*.ts', {
  eager: true,
  import: 'default'
})

interface DB {
  store: { item: string; name: string; namespace: string; key: GeneratedAlways<string> }
}
const database = useGlobalVar(await Database.load(`sqlite:native_store.db`), 'core/store/raw')

const emitter = mitt<{ onChange: void }>()

const MUTATION_KEYWORDS = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i
const triggerUpdate = debounce(() => {
  console.debug('[db sync] db changed')
  emitter.emit('onChange')
  triggerRef(db)
}, 300)

const db = useGlobalVar(
  await (async () => {
    const db = shallowRef(
      new Kysely<DB>({
        dialect: new TauriSqliteDialect({
          database: {
            close(db) {
              return database.close(db)
            },
            path: database.path,
            async select<T>(query: string, bindValues?: unknown[]) {
              console.debug('sql!', query, bindValues)
              const result = await database.select<T>(query, bindValues)
              if (MUTATION_KEYWORDS.test(query)) triggerUpdate()
              return result
            },
            async execute(query: string, bindValues?: unknown[]) {
              console.debug('sql!', query, bindValues)
              const result = await database.execute(query, bindValues)
              if (MUTATION_KEYWORDS.test(query)) triggerUpdate()
              return result
            }
          }
        }),
        plugins: [new CamelCasePlugin(), new SerializePlugin()]
      })
    )
    const migrator = new Migrator({
      db: db.value,
      provider: {
        async getMigrations() {
          return migrations
        }
      }
    })
    await migrator.migrateToLatest()
    return db
  })(),
  'core/store/ins'
)

const saveKey = new SourcedValue<[namespace: string, key: string]>()
export const useNativeStore = <T extends object>(
  namespace: string,
  key: MaybeRefOrGetter<string>,
  defaultValue: MaybeRefOrGetter<T>
) => {
  return useLocalStorage(saveKey.toString([namespace, toValue(key)]), defaultValue)
  // return useStorageAsync<T>(saveKey.toString([namespace, toRef(key).value]), defaultValue, {
  //   async removeItem(key) {
  //     const [ns, k] = saveKey.toJSON(key)
  //     await db.value.deleteFrom('store').where('namespace', '=', ns).where('name', '=', k).execute()
  //   },
  //   async getItem(key) {
  //     const [ns, k] = saveKey.toJSON(key)
  //     const result = await db.value
  //       .selectFrom('store')
  //       .selectAll()
  //       .where('namespace', '=', ns)
  //       .where('name', '=', k)
  //       .executeTakeFirst()
  //     return result?.item ?? null
  //   },
  //   async setItem(key, value) {
  //     const [namespace, name] = saveKey.toJSON(key)
  //     await db.value
  //       .replaceInto('store')
  //       .values({ namespace, name, item: value })
  //       .execute()
  //   }
  // })
}