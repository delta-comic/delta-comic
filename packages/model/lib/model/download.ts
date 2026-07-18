import type { Metadata, Metadatable } from '@/struct'

import type { ContentPage } from './content'

export type DownloadChecksumAlgorithm = 'sha256' | 'md5'

export interface DownloadChecksum {
  algorithm: DownloadChecksumAlgorithm
  value: string
}

/** A JSON-safe HTTP header value. Sensitive values should be passed by reference. */
export type HttpHeaderValue =
  | { type: 'value'; value: string }
  | { type: 'secretRef'; secretRef: string }

export interface HttpMirror {
  url: string
  /** Larger values are tried first. Mirrors with the same priority keep their declared order. */
  priority?: number
  headers?: Record<string, HttpHeaderValue>
}

export interface HttpSource {
  type: 'http'
  mirrors: HttpMirror[]
  etag?: string
  lastModified?: string
  expectedSize?: number
  /** Unix timestamp in milliseconds after which the source should be refreshed. */
  expiresAt?: number
}

export type TorrentInput =
  | { type: 'magnet'; uri: string }
  | { type: 'url'; url: string }
  | { type: 'bytes'; base64: string }

export type TorrentSeedPolicy =
  | { mode: 'none' }
  | { mode: 'ratio'; ratio: number }
  | { mode: 'duration'; durationSeconds: number }
  | { mode: 'ratioOrDuration'; ratio: number; durationSeconds: number }

export interface TorrentSource {
  type: 'torrent'
  input: TorrentInput
  /** Zero-based file indexes in torrent metadata. Omit to download every file. */
  onlyFiles?: number[]
  seedPolicy?: TorrentSeedPolicy
}

export type DownloadSource = HttpSource | TorrentSource

/** A JSON-serializable file entry produced by a content plugin. */
export interface DownloadAsset {
  /** Stable within the containing plan and across retries. */
  key: string
  /** Relative to the destination selected by the host application. */
  relativePath: string
  size?: number
  checksum?: DownloadChecksum
  source: DownloadSource
}

/** A JSON-serializable group of files that should be enqueued together. */
export interface DownloadPlan {
  /** Stable for the content represented by this plan. */
  key: string
  title: string
  assets: DownloadAsset[]
}

export type ContentDownloadSelection =
  | { type: 'currentEpisode' }
  | { type: 'episodes'; episodeIds: string[] }
  | { type: 'allEpisodes' }

export interface ResolveDownloadInput {
  page: ContentPage
  selection: ContentDownloadSelection
}

export type RefreshSourceReason = 'expired' | 'unauthorized' | 'forbidden'

export interface RefreshSourceInput {
  page: ContentPage
  planKey: string
  assetKey: string
  source: DownloadSource
  reason: RefreshSourceReason
}

/**
 * Resolves plugin-specific content into a portable download plan.
 *
 * Providers are runtime objects and are not serialized. Their returned plans and sources must be
 * JSON-serializable so the native downloader can persist and resume them without a live WebView.
 */
export interface ContentDownloadProvider {
  resolve(input: ResolveDownloadInput, signal: AbortSignal): Promise<DownloadPlan>
  refreshSource?(input: RefreshSourceInput, signal: AbortSignal): Promise<DownloadSource>
}

/**
 * Legacy imperative download controller.
 *
 * @deprecated Register a {@link ContentDownloadProvider} for the content type and let the native
 * downloader own task state, persistence, and lifecycle controls. This class remains unchanged so
 * existing plugins can migrate without an immediate breaking change.
 */
export abstract class Downloader implements Metadatable {
  public abstract id: string
  public abstract name: string
  public abstract $$plugin: string
  public abstract $$meta?: Metadata

  public abstract begin: () => void
  public abstract resume: () => void
  public abstract pause: () => void
}

/** @deprecated Use {@link ContentDownloadProvider}. */
export type LegacyDownloader = Downloader