import { appLocalDataDir } from '@tauri-apps/api/path'
import type { PluginArchiveDB } from '../db'
import type { PluginConfig, PluginMeta } from 'delta-comic-core'
const appLocalDataDirPath = await appLocalDataDir()
export const getPluginFsPath = (pluginName: string) => `${appLocalDataDirPath}/plugin/${pluginName}`.replaceAll('\\','/')

export interface PluginInstallerDescription {
  title: string
  description: string
}
export abstract class PluginInstaller {
  public abstract install(input: string): Promise<PluginFile>
  public abstract update(pluginMeta: PluginArchiveDB.Meta): Promise<PluginFile>
  public abstract isMatched(input: string): boolean
  public abstract name: string
  public abstract description: PluginInstallerDescription
}


export interface PluginFile {
  blob: Blob
  fileName: string
}

export abstract class PluginLoader {
  public abstract name: string
  public abstract load(pluginMeta: PluginArchiveDB.Meta): Promise<any>
  public abstract installDownload(file: PluginFile): Promise<PluginMeta>
  public abstract canInstall(file: PluginFile): boolean
}


export type PluginBooterSetMeta = (meta: Partial<{
  description: string
  name: string
}> | string) => void

export abstract class PluginBooter {
  public abstract name: string
  public abstract call(cfg: PluginConfig, setMeta: PluginBooterSetMeta, env: Record<any, any>): Promise<any>
}