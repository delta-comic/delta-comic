import { Downloader } from '@delta-comic/downloader'
import { logger } from '@delta-comic/logger'
import ky from 'ky'

import { isTauriRuntime } from '../../../driver/init/storage'

export const MAX_PLUGIN_ASSET_BYTES = 128 * 1024 * 1024
export const PLUGIN_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000

const downloader = Downloader.get()
const assetLogger = logger.scoped('plugin:install:asset')

export interface DownloadInstallerAssetOptions {
  retry: number
  maxBytes?: number
}

/**
 * Managed downloads are intentionally bypassed here: installer assets are temporary and must
 * never appear in the user's download queue or leave a task record behind.
 */
export const downloadInstallerAsset = async (
  url: string,
  options: DownloadInstallerAssetOptions,
): Promise<Blob> => {
  assetLogger.info('installer asset download started', {
    maxBytes: options.maxBytes ?? MAX_PLUGIN_ASSET_BYTES,
    runtime: isTauriRuntime() ? 'tauri' : 'web',
  })
  if (isTauriRuntime()) {
    const bytes = await downloader.downloadEphemeral(url, {
      maxBytes: options.maxBytes ?? MAX_PLUGIN_ASSET_BYTES,
    })
    assetLogger.info('installer asset download completed', { bytes: bytes.byteLength })
    return new Blob([bytes])
  }

  const blob = await ky
    .get(url, { retry: options.retry, timeout: PLUGIN_DOWNLOAD_TIMEOUT_MS })
    .blob()
  assetLogger.info('installer asset download completed', { bytes: blob.size })
  return blob
}