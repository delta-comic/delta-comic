import { _pluginExposes, Utils } from "delta-comic-core"
import { $initCore } from "./core"
import { remove } from "es-toolkit"
import { isEmpty } from "es-toolkit/compat"
import { PluginArchiveDB } from "./db"
import { loadPlugin } from "./init"
import { pluginName } from "@/symbol"

export const loadAllPlugins = Utils.data.PromiseContent.fromAsyncFunction(async () => {
  await $initCore()

  /* 
    查找循环引用原理
    正常的插件一定可以被格式化为一个多入口树，
    因此无法被放入树的插件一定存在循环引用
  */
  const foundDeps = new Set<string>([pluginName])
  const plugins = await PluginArchiveDB.getByEnabled(true)
  const allLevels = new Array<PluginArchiveDB.Meta[]>()
  while (true) {
    const level = plugins.filter(p => p.meta.require.every(d => foundDeps.has(d.id)))
    allLevels.push(level)
    remove(plugins, p => level.includes(p))
    for (const { pluginName } of level) foundDeps.add(pluginName)
    if (isEmpty(level)) break
  }
  if (!isEmpty(plugins))
    throw new Error(`插件循环引用: ${plugins.map(v => v.pluginName).join(', ')}`)

  for (const level of allLevels)
    await Promise.all(level.map(p => loadPlugin(p)))

  console.log('[plugin bootPlugin] all load done')
})

export * from './init'