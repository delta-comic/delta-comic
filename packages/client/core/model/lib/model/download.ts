import type { Metadata, Metadatable } from '@/struct'

import type { UniContentPage } from './content'

export type UniDownloadChecksumAlgorithm = 'sha256' | 'md5'

export interface UniDownloadChecksum {
  algorithm: UniDownloadChecksumAlgorithm
  value: string
}

/** A JSON-safe HTTP header value. Sensitive values should be passed by reference. */
export type UniDownloadHttpHeaderValue =
  | { type: 'value'; value: string }
  | { type: 'secretRef'; secretRef: string }

export interface UniDownloadHttpMirror {
  url: string
  /** Larger values are tried first. Mirrors with the same priority keep their declared order. */
  priority?: number
  headers?: Record<string, UniDownloadHttpHeaderValue>
}

export interface UniDownloadHttpSource {
  type: 'http'
  mirrors: UniDownloadHttpMirror[]
  etag?: string
  lastModified?: string
  expectedSize?: number
  /** Unix timestamp in milliseconds after which the source should be refreshed. */
  expiresAt?: number
}

export type UniDownloadTorrentInput =
  | { type: 'magnet'; uri: string }
  | { type: 'url'; url: string }
  | { type: 'bytes'; base64: string }

export type UniDownloadTorrentSeedPolicy =
  | { mode: 'none' }
  | { mode: 'ratio'; ratio: number }
  | { mode: 'duration'; durationSeconds: number }
  | { mode: 'ratioOrDuration'; ratio: number; durationSeconds: number }

export interface UniDownloadTorrentSource {
  type: 'torrent'
  input: UniDownloadTorrentInput
  /** Zero-based file indexes in torrent metadata. Omit to download every file. */
  onlyFiles?: number[]
  seedPolicy?: UniDownloadTorrentSeedPolicy
}

export type UniDownloadSource = UniDownloadHttpSource | UniDownloadTorrentSource

/** A JSON-serializable file entry produced by a content plugin. */
export interface UniDownloadAsset {
  /** Stable within the containing plan and across retries. */
  key: string
  /** Relative to the destination selected by the host application. */
  relativePath: string
  size?: number
  checksum?: UniDownloadChecksum
  source: UniDownloadSource
}

/** A JSON-serializable group of files that should be enqueued together. */
export interface UniDownloadPlan {
  /** Stable for the content represented by this plan. */
  key: string
  title: string
  assets: UniDownloadAsset[]
}

export type UniContentDownloadSelection =
  | { type: 'currentEpisode' }
  | { type: 'episodes'; episodeIds: string[] }
  | { type: 'allEpisodes' }

export interface UniDownloadResolveInput {
  page: UniContentPage
  selection: UniContentDownloadSelection
}

export type UniDownloadRefreshSourceReason = 'expired' | 'unauthorized' | 'forbidden'

export interface UniDownloadRefreshSourceInput {
  page: UniContentPage
  planKey: string
  assetKey: string
  source: UniDownloadSource
  reason: UniDownloadRefreshSourceReason
}

/**
 * Resolves plugin-specific content into a portable download plan.
 *
 * Providers are runtime objects and are not serialized. Their returned plans and sources must be
 * JSON-serializable so the native downloader can persist and resume them without a live WebView.
 */
export interface UniContentDownloadProvider {
  resolve(input: UniDownloadResolveInput, signal: AbortSignal): Promise<UniDownloadPlan>
  refreshSource?(
    input: UniDownloadRefreshSourceInput,
    signal: AbortSignal,
  ): Promise<UniDownloadSource>
}

/**
 * Legacy imperative download controller.
 *
 * @deprecated Register a {@link UniContentDownloadProvider} for the content type and let the native
 * downloader own task state, persistence, and lifecycle controls. This class remains unchanged so
 * existing plugins can migrate without an immediate breaking change.
 */
export abstract class UniDownloader implements Metadatable {
  public abstract id: string
  public abstract name: string
  public abstract $$plugin: string
  public abstract $$meta?: Metadata

  public abstract begin: () => void
  public abstract resume: () => void
  public abstract pause: () => void
}

/** @deprecated Use {@link UniContentDownloadProvider}. */
export type UniLegacyDownloader = UniDownloader