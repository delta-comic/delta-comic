import type { PluginInstallOptions } from '@delta-comic/plugin'
import { createDownloadMessage } from '@delta-comic/ui'
import { useI18n } from 'vue-i18n'

import { formatBytes } from '@/features/downloads/format'

import { pluginInstallProgressPercentage } from './progress'

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
    createDownloadMessage(title, ({ createProgress }) =>
      createProgress(t('plugin.progress.installing'), async control => {
        control.retryable = true
        return await operation({
          report(progress) {
            control.description = progress.downloadedBytes
              ? t('plugin.progress.downloaded', {
                  downloaded: formatBytes(progress.downloadedBytes),
                  total: formatBytes(progress.totalBytes),
                })
              : progress.description || phaseDescription[progress.phase]()
            control.progress = pluginInstallProgressPercentage(progress)
          },
        })
      }),
    )

  return { runPluginInstall }
}