import { appLocalDataDir, join } from '@tauri-apps/api/path'
import type { PluginConfig, PluginMeta } from 'delta-comic-core'

import type { PluginArchiveDB } from '../db'
const appLocalDataDirPath = await appLocalDataDir()
export const getPluginFsPath = async (pluginName: string) =>
  await join(appLocalDataDirPath, 'plugin', pluginName)
export interface PluginInstallerDescription {
  title: string
  description: string
}
export abstract class PluginInstaller {
  public abstract install(input: string): Promise<File>
  public abstract update(pluginMeta: PluginArchiveDB.Meta): Promise<File>
  public abstract isMatched(input: string): boolean
  public abstract name: string
  public abstract description: PluginInstallerDescription
}

export abstract class PluginLoader {
  public abstract name: string
  public abstract load(pluginMeta: PluginArchiveDB.Meta): Promise<any>
  public abstract installDownload(file: File): Promise<PluginMeta>
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