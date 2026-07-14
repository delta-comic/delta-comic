import type { FormResult, FormSingleConfigure } from '@delta-comic/model'
import { fromPairs } from 'es-toolkit/compat'
import { ref, watch, type Ref } from 'vue'

export type ConfigDescription = Record<
  string,
  Required<Pick<FormSingleConfigure, 'defaultValue'>> & FormSingleConfigure
>

export interface Table {
  /** @description config owner, usually plugin name */
  belongTo: string
  /** @description serialized form structure */
  form: string
  /** @description serialized config data */
  data: string
}

export type ConfigRef<T> = Ref<T> & { readonly ready: Promise<void> }

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

const createDefaultData = <T extends ConfigDescription>(config: T): FormResult<T> =>
  fromPairs(
    Object.entries(config).map(([name, desc]) => [name, desc.defaultValue]),
  ) as FormResult<T>

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (!value) return cloneValue(fallback)
  if (typeof value !== 'string') return cloneValue(value as T)
  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn('[db] failed to parse config value', error)
    return cloneValue(fallback)
  }
}

const upsertConfig = async (belongTo: string, form: ConfigDescription, data: unknown) => {
  const { db } = await import('.')
  await db
    .replaceInto('config')
    .values({ belongTo, form: JSON.stringify(form), data: JSON.stringify(data) })
    .execute()
}

export const useConfig = <T extends ConfigDescription>(
  belongTo: string,
  form: T,
): ConfigRef<FormResult<T>> => {
  const defaultData = createDefaultData(form)
  const data = ref(cloneValue(defaultData)) as Ref<FormResult<T>>
  let hydrated = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void upsertConfig(belongTo, form, data.value).catch(error => {
        console.warn('[db] failed to persist config value', error)
      })
    }, 100)
  }

  const ready = (async () => {
    try {
      const { db } = await import('.')
      const stored = await db
        .selectFrom('config')
        .select(['form', 'data'])
        .where('belongTo', '=', belongTo)
        .executeTakeFirst()
      data.value = parseJson(stored?.data, defaultData)
      hydrated = true
      const storedForm =
        typeof stored?.form === 'string' ? stored.form : JSON.stringify(stored?.form)
      if (!stored || storedForm !== JSON.stringify(form)) persist()
    } catch (error) {
      console.warn('[db] failed to load config value', error)
      data.value = cloneValue(defaultData)
      hydrated = true
    }
  })()

  watch(
    data,
    () => {
      if (!hydrated) return
      persist()
    },
    { deep: true, flush: 'sync' },
  )

  return Object.assign(data, { ready })
}