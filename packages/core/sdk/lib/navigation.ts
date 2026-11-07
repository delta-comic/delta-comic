import type { UniContentType_, UniItem } from '@delta-comic/client-model'

/** @internal Host navigation registration types. */
declare module '@delta-comic/client-utils' {
  interface SharedFunctions {
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
  }
}

export const routeToContent = async (
  contentType: UniContentType_,
  id: string,
  ep: string,
  preload?: UniItem,
): Promise<void> => {
  const { SharedFunction } = await import('@delta-comic/client-utils')
  await SharedFunction.call('routeToContent', contentType, id, ep, preload)
}

export const routeToSearch = async (
  input: string,
  source?: [plugin: string, method: string],
  sort?: string,
): Promise<void> => {
  const { SharedFunction } = await import('@delta-comic/client-utils')
  await SharedFunction.call('routeToSearch', input, source, sort)
}