import type { UniContentType_, UniItem } from '@delta-comic/model'

declare module '@delta-comic/utils' {
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