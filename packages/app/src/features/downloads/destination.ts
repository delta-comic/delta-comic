import type { uni } from '@delta-comic/model'

import type { Destination } from './downloaderClient'

export interface ContentDownloadRequest {
  destinationId?: string
  selection: uni.download.ContentDownloadSelection
}

export function resolveDestinationId(
  destinations: readonly Destination[],
  currentDestinationId?: string,
): string | undefined {
  if (
    currentDestinationId &&
    destinations.some(destination => destination.id === currentDestinationId)
  )
    return currentDestinationId

  return destinations.find(destination => destination.isDefault)?.id ?? destinations[0]?.id
}