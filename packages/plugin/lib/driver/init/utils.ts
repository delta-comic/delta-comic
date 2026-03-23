import type { PluginArchiveDB } from '@delta-comic/db'
import { appLocalDataDir, join } from '@tauri-apps/api/path'

import type { PluginConfig } from '@/plugin'

const appLocalDataDirPath = await appLocalDataDir()
export const getPluginFsPath = async (pluginName: string) =>
  await join(appLocalDataDirPath, 'plugin', pluginName)
export interface PluginInstallerDescription {
  title: string
  description: string
}
export abstract class PluginInstaller {
  public abstract download(input: string): Promise<File | string>
  public abstract update(pluginMeta: PluginArchiveDB.Archive): Promise<File | string>
  public abstract isMatched(input: string): boolean
  public abstract name: string
  public abstract description: PluginInstallerDescription
}

export abstract class PluginLoader {
  public abstract name: string
  public abstract load(pluginMeta: PluginArchiveDB.Archive): Promise<any>
  public abstract install(file: File): Promise<PluginArchiveDB.Meta>
  public abstract decodeMeta(file: File): Promise<PluginArchiveDB.Meta>
  public abstract canInstall(file: File): boolean
}

export type PluginBooterSetMeta = (
  meta: Partial<{ description: string; name: string }> | string
) => void

export abstract class PluginBooter {
  public abstract name: string
  public abstract call(
    cfg: PluginConfig,
    setMeta: PluginBooterSetMeta,
    env: Record<any, any>
  ): Promise<any>
}