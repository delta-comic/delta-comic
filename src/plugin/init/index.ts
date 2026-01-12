import { Utils, type PluginConfig } from "delta-comic-core"
import { sortBy } from "es-toolkit/compat"
import { usePluginStore } from "../store"
import { isString } from "es-toolkit"
import { markRaw, reactive } from "vue"
import { until } from "@vueuse/core"
import { PluginArchiveDB } from "../db"
import { pluginName } from "@/symbol"
import { db } from "@/db"
import type { PluginBooter, PluginInstaller, PluginLoader } from "./utils"


const rawBooters = import.meta.glob<PluginBooter>('./booter/*_*.ts', {
  eager: true,
  import: 'default'
})
const booters = sortBy(Object.entries(rawBooters), ([fname]) => Number(fname.match(/[\d\.]+(?=_)/)?.[0])).map(v => v[1])

export const bootPlugin = async (cfg: PluginConfig) => {
  const { plugins, pluginSteps } = usePluginStore()
  plugins.set(cfg.name, markRaw(cfg))
  try {
    const env: Record<any, any> = {}
    for (const booter of booters) {
      const msIndex = pluginSteps[cfg.name].steps.length
      pluginSteps[cfg.name].steps[msIndex] = {
        name: booter.name,
        description: ''
      }
      pluginSteps[cfg.name].now.stepsIndex = msIndex
      pluginSteps[cfg.name].now.status = 'process'
      await booter.call(cfg, meta => {
        if (isString(meta)) pluginSteps[cfg.name].steps[msIndex].description = meta
        else {
          if (meta.description) pluginSteps[cfg.name].steps[msIndex].description = meta.description
          if (meta.name) pluginSteps[cfg.name].steps[msIndex].name = meta.name
        }
      }, env)
    }
  } catch (error) {
    pluginSteps[cfg.name].now.status = 'error'
    pluginSteps[cfg.name].now.error = error as Error
    throw error
  }
  console.log(`[plugin usePluginStore.$loadPlugin] plugin "${cfg.name}" load done`)
}



const rawInstallers = import.meta.glob<PluginInstaller>('./installer/*_*.ts', {
  eager: true,
  import: 'default'
})
const installers = sortBy(Object.entries(rawInstallers), ([fname]) => Number(fname.match(/[\d\.]+(?=_)/)?.[0])).map(v => v[1]).reverse()

export const installPlugin = (input: string, __installedPlugins?: Set<string>) =>
  Utils.message.createDownloadMessage('下载插件', async m => {
    const [file, installer] = await m.createLoading('下载', async v => {
      v.retryable = true
      const installer = installers.filter(ins => ins.isMatched(input)).at(-1)
      if (!installer) throw new Error('没有符合的下载器:' + input)
      v.description = installer.name
      return [
        await installer.install(input),
        installer
      ] as const
    })

    const meta = await m.createLoading('安装插件', async v => {
      v.retryable = true
      const loader = loaders.filter(ins => ins.canInstall(file)).at(-1)
      if (!loader) throw new Error('没有符合的安装器:' + input)
      v.description = loader.name

      const meta = await loader.installDownload(file)

      v.description = '写入数据库'
      await db.value
        .replaceInto('plugin')
        .values({
          displayName: meta.name.display,
          enable: true,
          installerName: installer.name,
          installInput: input,
          loaderName: loader.name,
          meta: JSON.stringify(meta),
          pluginName: meta.name.id
        })
        .execute()

      return meta
    })

    const plugins = __installedPlugins ?? new Set((await db.value
      .selectFrom('plugin')
      .select('pluginName')
      .execute()).map(v => v.pluginName))
    for (const { id, download } of meta.require) {
      const isDownloaded = plugins.has(id)
      if (isDownloaded || !download) continue
      await installPlugin(download)
    }
  })

export const updatePlugin = async (pluginMeta: PluginArchiveDB.Meta) => {
  const installer = installers.find(v => v.name == pluginMeta.installerName)
  if (!installer) throw new Error('没有符合的下载器')

  const loader = loaders.find(v => v.name == pluginMeta.loaderName)
  if (!loader) throw new Error('没有符合的安装器')

  const file = await installer.update(pluginMeta)
  const meta = await loader.installDownload(file)
  await db.value
    .replaceInto('plugin')
    .values({
      ...pluginMeta,
      meta: JSON.stringify(meta)
    })
    .execute()
}

const rawLoaders = import.meta.glob<PluginLoader>('./loader/*_*.ts', {
  eager: true,
  import: 'default'
})
const loaders = sortBy(Object.entries(rawLoaders), ([fname]) => Number(fname.match(/[\d\.]+(?=_)/)?.[0])).map(v => v[1])

const loadings = reactive<Record<string, boolean>>({})
const { SharedFunction } = Utils.eventBus

export const loadPlugin = async (pluginMeta: PluginArchiveDB.Meta) => {
  const store = usePluginStore()
  store.pluginSteps[pluginMeta.pluginName] = {
    now: {
      status: 'wait',
      stepsIndex: 0
    },
    steps: [{
      name: '等待',
      description: '插件载入中'
    }]
  }
  await loaders.find(v => v.name == pluginMeta.loaderName)!.load(pluginMeta)
  await until(() => loadings[pluginMeta.loaderName]).toBeTruthy()
  console.log(`[plugin bootPlugin] booting name "${pluginMeta.loaderName}"`)
}
SharedFunction.define(async cfg => {
  console.log('[plugin addPlugin] new plugin defined', cfg)
  await bootPlugin(cfg)
  loadings[cfg.name] = true
}, pluginName, 'addPlugin')


export {
  loaders as pluginLoaders,
  installers as pluginInstallers
}
window.$api.loaders = loaders
window.$api.installers = installers