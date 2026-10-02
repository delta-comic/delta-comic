import type { FormSingleConfigure } from '@delta-comic/model'

export type ConfigDescription = Record<
  string,
  Required<Pick<FormSingleConfigure, 'defaultValue'>> & FormSingleConfigure
>

export type UnwrapConfigPointer<T extends ConfigPointer> = T['_type']

export class ConfigPointer<T extends ConfigDescription = ConfigDescription> {
  public readonly key: symbol
  declare public readonly _type: T

  public constructor(
    public readonly pluginName: string,
    public readonly config: T,
    public readonly configName: string,
  ) {
    this.key = Symbol.for(`config:${pluginName}`)
  }
}