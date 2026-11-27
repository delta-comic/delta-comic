import type { UniContentType_, UniItem } from '@delta-comic/platform/model'

declare module '@delta-comic/platform/utils' {
  export interface SharedFunctions {
    routeToContent(
      contentType: UniContentType_,
      id: string,
      ep: string,
      preload?: UniItem,
    ): Promise<unknown>
    routeToSearch(
      input: string,
      source?: [plugin: string, method: string],
      sort?: string,
    ): Promise<unknown>
    pushShareToken(token: string): Promise<unknown>
  }
}