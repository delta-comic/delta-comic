export * from './cache'
export * from './client'
export * from './types'
export * from './validation'

import type { AwesomePluginDownload, AwesomePluginListing } from './types'

export const marketplaceDownloadToInstallInput = (download: AwesomePluginDownload) =>
  download.type === 'github' ? `gh:${download.repository}` : download.url

export const marketplaceListingInstallId = (listing: AwesomePluginListing) => `ap:${listing.id}`

export const marketplaceListingSource = (listing: AwesomePluginListing) =>
  listing.download.type === 'github'
    ? `https://github.com/${listing.download.repository}`
    : listing.download.url