import { PluginArchiveDB, useNativeStore, db } from '@delta-comic/db'
import { createDownloadMessage, type DownloadMessageBind } from '@delta-comic/ui'
import { isString } from 'es-toolkit'
import { sortBy } from 'es-toolkit/compat'

import { coreName } from './core'
import type { PluginInstaller } from './init/utils'
import { loaders } from './loader'

const rawInstallers = import.meta.glob<PluginInstaller>('./init/installer/*_*.ts', {
  eager: true,
  import: 'default'
})
export const installers = sortBy(Object.entries(rawInstallers), ([fname]) =>
  Number(fname.match(/[\d\.]+(?=_)/)?.[0])
)
  .map(v => v[1])
  .reverse()

export interface SourceOverrideConfig {
  id: string
  install: string
  enabled: boolean
}

export const usePluginConfig = () =>
  useNativeStore(coreName, 'pluginInstallSourceOverrides', new Array<SourceOverrideConfig>())

export const installDepends = (
  m: DownloadMessageBind,
  meta: PluginArchiveDB.Meta,
  installedPlugins?: Set<string>
) =>
  m.createLoading('依赖安装/检查', async v => {
    v.retryable = true
    let count = 0
    const plugins =
      installedPlugins ??
      new Set((await db.selectFrom('plugin').select('pluginName').execute()).map(v => v.pluginName))
    const overrides = usePluginConfig()
    for (const { id, download } of meta.require) {
      const isDownloaded = plugins.has(id)
      if (isDownloaded || !download) continue
      console.log(`从 ${meta.name.id} 发现未安装依赖: ${id} ->`, download)
      v.description = `安装: ${id}`
      let downloadCommend = overrides.value.find(c => c.id == id && c.enabled)?.install ?? download
      await installPlugin(downloadCommend)
      count++
    }
    v.description = `安装完成，共${count}个`
  })

const installPluginFile = async (
  m: DownloadMessageBind,
  file: File,
  installerName: string,
  installInput: string,
  __installedPlugins?: Set<string>
) => {
  const meta = await m.createLoading('安装插件', async v => {
    v.retryable = true
    const loader = loaders.filter(ins => ins.canInstall(file)).at(-1)
    if (!loader) throw new Error('没有符合的安装器')
    v.description = loader.name

    const meta = await loader.installDownload(file)

    v.description = '写入数据库'
    const { upsert } = PluginArchiveDB.useUpsert()
    await upsert({
      archives: [
        {
          displayName: meta.name.display,
          enable: true,
          installerName,
          installInput,
          loaderName: loader.name,
          meta,
          pluginName: meta.name.id
        }
      ]
    })
    return meta
  })
  console.log(`安装插件成功: ${meta.name.id} ->`, meta)

  await installDepends(m, meta, __installedPlugins)
}

export const installPlugin = (input: string, __installedPlugins?: Set<string>) =>
  createDownloadMessage(`下载插件-${input}`, async m => {
    const [file, installer] = await m.createLoading('下载', async v => {
      v.retryable = true
      let dlCommend = input
      for (;;) {
        const installer = installers.filter(ins => ins.isMatched(dlCommend)).at(0)
        if (!installer) throw new Error('没有符合的下载器:' + dlCommend)
        v.description = installer.name
        const meta = await installer.install(dlCommend)
        if (isString(meta)) dlCommend = meta
        else return [meta, installer] as const
      }
    })

    await installPluginFile(m, file, installer.name, input, __installedPlugins)
  })

export const installFilePlugin = (file: File, __installedPlugins?: Set<string>) =>
  createDownloadMessage(`安装插件-${file.name}`, async m => {
    await installPluginFile(m, file, '', '', __installedPlugins)
  })

export const updatePlugin = async (
  pluginMeta: PluginArchiveDB.Archive,
  __installedPlugins?: Set<string>
) =>
  createDownloadMessage(`更新插件-${pluginMeta.pluginName}`, async m => {
    const file = await m.createLoading('更新', async v => {
      v.retryable = true
      let installerName = pluginMeta.installerName
      for (;;) {
        const installer = installers.find(v => v.name == installerName)
        if (!installer) throw new Error('没有符合的下载器')
        v.description = installer.name
        const file = await installer.update(pluginMeta)
        if (isString(file)) installerName = file
        else return file
      }
    })

    const meta = await m.createLoading('安装插件', async v => {
      v.retryable = true
      const loader = loaders.find(v => v.name == pluginMeta.loaderName)
      if (!loader) throw new Error('没有符合的安装器')
      return await loader.installDownload(file)
    })

    const { upsert } = PluginArchiveDB.useUpsert()
    await upsert({ archives: [{ ...pluginMeta, meta }] })

    await installDepends(m, meta, __installedPlugins)
  })