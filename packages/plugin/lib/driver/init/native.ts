import type { PluginArchiveDB } from '@delta-comic/db'
import { logger } from '@delta-comic/logger'

import { decodeDevMetaFromCode, isTauriRuntime } from './storage'

const nativeInstallLogger = logger.scoped('plugin:native-install')

const progressEvent = 'plugin://install-progress'

const call = async <T>(command: string, args: Record<string, unknown>) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<T>(`plugin:plugin|${command}`, args)
}

export interface NativeInstallProgress {
  current: number
  opId: string
  path?: string
  phase: 'done' | 'extract' | 'start'
  total: number
}

interface NativeLocalFile {
  bytes: number[]
  name: string
}

export const createNativeOperationId = () => crypto.randomUUID()

export const writeNativeTempFile = async (file: File): Promise<string> => {
  nativeInstallLogger.debug('writing native installer temporary file', { bytes: file.size })
  const [{ appLocalDataDir, join }, fs] = await Promise.all([
    import('@tauri-apps/api/path'),
    import('@tauri-apps/plugin-fs'),
  ])
  const temp = await join(await appLocalDataDir(), 'plugin', '__temp__')
  await fs.mkdir(temp, { recursive: true })
  const safeName = file.name.replace(/[\\/]/g, '_') || 'plugin.bin'
  const path = await join(temp, `${Date.now()}-${crypto.randomUUID()}-${safeName}`)
  await fs.writeFile(path, new Uint8Array(await file.arrayBuffer()))
  nativeInstallLogger.debug('native installer temporary file written')
  return path
}

export const readLocalFile = async (path: string): Promise<File> => {
  const file = await call<NativeLocalFile>('read_local_file', { path })
  return new File([new Uint8Array(file.bytes)], file.name)
}

export const prepareDevScript = (input: string, code: string) =>
  isTauriRuntime()
    ? call<string>('prepare_dev_script', { code, input })
    : Promise.resolve(code.replaceAll('localhost', input).replaceAll('127.0.0.1', input))

export const decodeDevMeta = (code: string) =>
  isTauriRuntime()
    ? call<PluginArchiveDB.Meta>('decode_dev_meta', { code })
    : Promise.resolve(decodeDevMetaFromCode(code))

export const installDev = (code: string) => call<PluginArchiveDB.Meta>('install_dev', { code })

export const decodeZipMeta = (zipPath: string) =>
  call<PluginArchiveDB.Meta>('decode_zip_meta', { zipPath })

export const installZip = async (
  zipPath: string,
  opId: string,
  onProgress?: (progress: NativeInstallProgress) => void,
) => {
  nativeInstallLogger.info('native plugin archive installation started')
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = onProgress
    ? await listen<NativeInstallProgress>(progressEvent, event => {
        if (event.payload.opId === opId) onProgress(event.payload)
      })
    : undefined
  try {
    const meta = await call<PluginArchiveDB.Meta>('install_zip', { opId, zipPath })
    nativeInstallLogger.info('native plugin archive installation completed', {
      plugin: meta.name.id,
    })
    return meta
  } catch (error) {
    nativeInstallLogger.error('native plugin archive installation failed', error)
    throw error
  } finally {
    unlisten?.()
  }
}