import type { uni } from '@delta-comic/model'

declare module '@delta-comic/utils' {
  export interface SharedFunctions {
    routeToContent(
      contentType_: uni.content.ContentType_,
      id: string,
      ep: string,
      preload?: uni.item.Item,
    ): Promise<any>
    routeToSearch(
      input: string,
      source?: [plugin: string, name: string],
      sort?: string,
    ): Promise<any>
    pushShareToken(token: string): Promise<any>
  }
}

export * from './plugin'
export * from './config'
export * from './depends'
export * from './global'
export * from './i18n'
export * from './manifest'
export * from './marketplace'
export * from './pluginIcon'
export * from './driver'