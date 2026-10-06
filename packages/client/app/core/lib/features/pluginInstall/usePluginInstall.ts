import type { PluginInstallOptions, PluginInstallProgress } from '@delta-comic/client-core-plugin'
import { useI18n } from 'vue-i18n'

import { getCoreHost } from '../../ports'
import { formatBytes } from '../downloads/format'

import { runPluginInstallPhases } from './runPluginInstallPhases'

export function usePluginInstall() {
  const { t } = useI18n()
  const phaseDescription = {
    decode: () => t('plugin.progress.installing'),
    persist: () => t('plugin.progress.persisting'),
    resolve: () => t('plugin.progress.downloading'),
  }

  const runPluginInstall = <T>(
    title: string,
    operation: (options: PluginInstallOptions) => Promise<T>,
  ) =>
    getCoreHost().ui.createDownloadMessage(title, bind =>
      runPluginInstallPhases(
        bind,
        {
          decode: t('plugin.progress.installing'),
          persist: t('plugin.progress.persisting'),
          resolve: t('plugin.progress.downloading'),
        },
        progressDescription,
        operation,
      ),
    )

  const progressDescription = (progress: PluginInstallProgress) =>
    progress.downloadedBytes
      ? t('plugin.progress.downloaded', {
          downloaded: formatBytes(progress.downloadedBytes),
          total: formatBytes(progress.totalBytes),
        })
      : progress.description || phaseDescription[progress.phase]()

  return { runPluginInstall }
}