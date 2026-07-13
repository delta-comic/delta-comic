import { PluginArchiveDB, db } from '@delta-comic/db'
import { createDownloadMessage, type DownloadMessageBind } from '@delta-comic/ui'
import { isString } from 'es-toolkit'

import { useConfig } from '@/config'
import { pluginI18n } from '@/i18n'

import { isBuiltInPlugin, isBuiltInPluginName } from './builtIn'
import { runtimeExtensions } from './extensions'
import { loaders } from './loader'
import { pluginRuntime } from './runtime'
import { pluginStore } from './store'

const clampProgress = (progress: number) => Math.min(100, Math.max(0, progress))

export const installers = runtimeExtensions.installers.values

export const installDepends = (
  m: DownloadMessageBind,
  meta: PluginArchiveDB.Meta,
  installedPlugins?: Set<string>,
) =>
  m.createLoading(pluginI18n.translate('plugin.progress.dependencies.checking'), async v => {
    v.retryable = true
    let count = 0
    const plugins =
      installedPlugins ??
      new Set((await db.selectFrom('plugin').select('pluginName').execute()).map(v => v.pluginName))
    const overrides = useConfig().$loadApp().data.value.installOverride
    for (const { id, download } of meta.require) {
      const isDownloaded = plugins.has(id)
      if (isDownloaded || !download) continue
      console.log(`从 ${meta.name.id} 发现未安装依赖: ${id} ->`, download)
      v.description = pluginI18n.translate('plugin.progress.dependencies.installing', { id })
      let downloadCommend = overrides.find(c => c.key == id)?.value ?? download
      await installPlugin(downloadCommend)
      count++
    }
    v.description = pluginI18n.translate('plugin.progress.dependencies.complete', { count })
  })

const installPluginFile = async (
  m: DownloadMessageBind,
  file: File,
  installerName: string,
  installInput: string,
  __installedPlugins?: Set<string>,
) => {
  const meta = await m.createProgress(
    pluginI18n.translate('plugin.progress.installing'),
    async v => {
      v.retryable = true
      const loader = loaders.filter(ins => ins.canInstall(file)).at(-1)
      if (!loader) throw new Error(pluginI18n.translate('plugin.install.errors.noInstaller'))
      v.description = loader.name
      v.progress = 0

      const meta = await loader.install(file, {
        report(progress) {
          if (progress.description) v.description = progress.description
          if (typeof progress.progress === 'number') v.progress = clampProgress(progress.progress)
        },
      })
      if (isBuiltInPluginName(meta.name.id)) {
        throw new Error(
          pluginI18n.translate('plugin.install.errors.reservedId', { id: meta.name.id }),
        )
      }

      v.description = pluginI18n.translate('plugin.progress.persisting')
      v.progress = 95
      await pluginStore.$upsertArchives([
        {
          displayName: meta.name.display,
          enable: true,
          installerName,
          installInput,
          loaderName: loader.name,
          meta,
          pluginName: meta.name.id,
        },
      ])
      v.progress = 100
      return meta
    },
  )
  console.log(`安装插件成功: ${meta.name.id} ->`, meta)

  await installDepends(m, meta, __installedPlugins)
}

export const installPlugin = (input: string, __installedPlugins?: Set<string>) =>
  createDownloadMessage(
    pluginI18n.translate('plugin.progress.downloadTitle', { input }),
    async m => {
      const [file, installer] = await m.createLoading(
        pluginI18n.translate('plugin.progress.downloading'),
        async v => {
          v.retryable = true
          let dlCommend = input
          for (;;) {
            const installer = installers.filter(ins => ins.isMatched(dlCommend)).at(0)
            if (!installer) {
              throw new Error(
                pluginI18n.translate('plugin.install.errors.noDownloader', { input: dlCommend }),
              )
            }
            v.description = installer.name
            const meta = await installer.download(dlCommend)
            if (isString(meta)) dlCommend = meta
            else return [meta, installer] as const
          }
        },
      )

      await installPluginFile(m, file, installer.name, input, __installedPlugins)
    },
  )

export const installFilePlugin = (file: File, __installedPlugins?: Set<string>) =>
  createDownloadMessage(
    pluginI18n.translate('plugin.progress.installTitle', { file: file.name }),
    async m => {
      await installPluginFile(m, file, '', '', __installedPlugins)
    },
  )

export const updatePlugin = async (
  pluginMeta: PluginArchiveDB.Archive,
  __installedPlugins?: Set<string>,
) => {
  if (isBuiltInPlugin(pluginMeta)) {
    throw new Error(pluginI18n.translate('plugin.install.errors.builtInUpdate'))
  }
  return createDownloadMessage(
    pluginI18n.translate('plugin.progress.updateTitle', { plugin: pluginMeta.pluginName }),
    async m => {
      const file = await m.createLoading(
        pluginI18n.translate('plugin.progress.updating'),
        async v => {
          v.retryable = true
          let installerName = pluginMeta.installerName
          for (;;) {
            const installer = installers.find(v => v.name == installerName)
            if (!installer)
              throw new Error(pluginI18n.translate('plugin.install.errors.noDownloader'))
            v.description = installer.name
            const file = await installer.update(pluginMeta)
            if (isString(file)) installerName = file
            else return file
          }
        },
      )

      const meta = await m.createProgress(
        pluginI18n.translate('plugin.progress.installing'),
        async v => {
          v.retryable = true
          const loader = loaders.find(v => v.name == pluginMeta.loaderName)
          if (!loader) throw new Error(pluginI18n.translate('plugin.install.errors.noInstaller'))
          v.description = loader.name
          v.progress = 0
          const meta = await loader.install(file, {
            report(progress) {
              if (progress.description) v.description = progress.description
              if (typeof progress.progress === 'number')
                v.progress = clampProgress(progress.progress)
            },
          })
          v.progress = 100
          return meta
        },
      )

      await pluginStore.$upsertArchives([{ ...pluginMeta, meta }])

      await installDepends(m, meta, __installedPlugins)
    },
  )
}

export const uninstallPlugin = (pluginName: string) => pluginRuntime.uninstall(pluginName)