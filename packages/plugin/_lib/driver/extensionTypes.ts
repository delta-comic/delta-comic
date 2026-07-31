import type { PluginArchiveDB } from '@delta-comic/db'

import type { PluginConfig, PluginConfigFactory } from '@/plugin'

export interface PluginInstallerDescription {
  title: string
  description: string
}
export abstract class PluginInstaller {
  /**
   * @returns string mean redirect
   */
  public abstract download(input: string): Promise<File | string>
  /**
   * @returns string mean redirect
   */
  public abstract update(pluginMeta: PluginArchiveDB.Archive): Promise<File | string>
  /**
   * @returns string mean redirect
   */
  public abstract fetchPluginMetaFile(input: string): Promise<File | string>

  public abstract isMatched(input: string): boolean
  public abstract name: string
  public abstract description: PluginInstallerDescription
}

export abstract class PluginLoader {
  public abstract name: string
  public abstract load(
    pluginMeta: PluginArchiveDB.Archive,
  ): Promise<PluginConfigFactory | undefined>
  public abstract install(
    file: File,
    context?: PluginLoaderInstallContext,
  ): Promise<PluginArchiveDB.Meta>
  public abstract canInstall(file: File): boolean

  /** need full download */
  public abstract decodeMeta(file: File): Promise<PluginArchiveDB.Meta>
  /** no need full download */
  public abstract decodeMetaFile(file: File): Promise<PluginArchiveDB.Meta | string>
  public abstract isMetaFile(file: File): boolean
}

export interface PluginLoaderInstallContext {
  report: (progress: PluginLoaderInstallProgress) => void
}

export interface PluginLoaderInstallProgress {
  description?: string
  progress?: number
}

export type PluginBooterSetMeta = (
  meta: Partial<{ description: string; name: string }> | string,
) => void

export abstract class PluginBooter {
  public abstract name: string
  public abstract call(
    cfg: PluginConfig,
    setMeta: PluginBooterSetMeta,
    env: Record<any, any>,
  ): Promise<any>
}