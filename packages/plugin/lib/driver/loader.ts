import { db, type PluginArchiveDB } from '@delta-comic/db'
import { PromiseContent } from '@delta-comic/model'
import { Mutex, remove } from 'es-toolkit'
import { isEmpty, sortBy } from 'es-toolkit/compat'

import { pluginEmitter } from '@/plugin'

import { bootPlugin } from './booter'
import type { PluginLoader } from './init/utils'
import { usePluginStore } from './store'

const rawLoaders = import.meta.glob<PluginLoader>('./init/loader/*_*.ts', {
  eager: true,
  import: 'default'
})
export const loaders = sortBy(Object.entries(rawLoaders), ([fname]) =>
  Number(fname.match(/[\d\.]+(?=_)/)?.[0])
).map(v => v[1])

const loadLocks = <Record<string, Mutex>>{}
const getLoadLock = (pluginName: string) => (loadLocks[pluginName] ??= new Mutex())

export const loadPlugin = async (meta: PluginArchiveDB.Archive) => {
  console.log(`[plugin bootPlugin] booting name "${meta.pluginName}"`)
  const lock = getLoadLock(meta.pluginName)
  const store = usePluginStore()
  store.pluginSteps[meta.pluginName] = {
    now: { status: 'wait', stepsIndex: 0 },
    steps: [{ name: '等待', description: '插件载入中' }]
  }
  try {
    await lock.acquire()
    await loaders.find(v => v.name == meta.loaderName)!.load(meta)
    await lock.acquire()
  } catch (error) {
    store.pluginSteps[meta.pluginName].now.status = 'error'
    store.pluginSteps[meta.pluginName].now.error = error as Error
    throw error
  }
  console.log(`[plugin bootPlugin] boot name done "${meta.pluginName}"`)
}
pluginEmitter.on('definedPlugin', async cfg => {
  console.log('[plugin addPlugin] new plugin defined', cfg.name, cfg)
  const lock = getLoadLock(cfg.name)
  await bootPlugin(cfg)
  console.log('[plugin addPlugin] done', cfg.name)
  lock.release()
})

export const loadAllPlugins = PromiseContent.fromAsyncFunction(async () => {
  const { $initCore, coreName } = await import('./core')
  await $initCore()
  /*
    查找循环引用原理
    正常的插件一定可以被格式化为一个多入口树，
    因此无法被放入树的插件一定存在循环引用
  */
  const foundDeps = new Set<string>([coreName])
  const plugins = await db.selectFrom('plugin').where('enable', 'is', true).selectAll().execute()
  const allLevels = new Array<PluginArchiveDB.Archive[]>()
  while (true) {
    const level = plugins.filter(p => p.meta.require.every(d => foundDeps.has(d.id)))
    allLevels.push(level)
    remove(plugins, p => level.includes(p))
    for (const { pluginName } of level) foundDeps.add(pluginName)
    if (isEmpty(level)) break
  }
  if (!isEmpty(plugins))
    throw new Error(`插件循环引用: ${plugins.map(v => v.pluginName).join(', ')}`)

  for (const level of allLevels) await Promise.all(level.map(p => loadPlugin(p)))

  console.log('[plugin bootPlugin] all load done')
})