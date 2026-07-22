import {
  Downloader,
  type ContentRefreshContext,
  type Destination,
  type DownloadCollection,
  type DownloaderCapabilities,
  type DownloaderEventHandlers,
  type DownloaderSettings,
  type DownloadSource,
  type DownloadTask,
  type DownloadTaskDetail,
  type EnqueuePlanInput,
  type EnqueueTorrentInput,
  type EnqueueUrlInput,
  type TaskAttention,
  type TaskRemovedEvent,
  type TaskUpsertEvent,
} from '@delta-comic/downloader'

export type {
  ContentRefreshContext,
  Destination,
  DownloadCollection,
  DownloadSource,
  DownloadTask,
  DownloadTaskDetail,
  DownloaderSettings,
  DownloaderCapabilities,
  EnqueuePlanInput,
  EnqueueTorrentInput,
  EnqueueUrlInput,
}

export type AddDownloadRequest =
  | { input: EnqueueTorrentInput; type: 'torrent' }
  | { input: EnqueueUrlInput; type: 'http' }

export type DownloadTaskUpsertEvent = TaskUpsertEvent
export type DownloadTaskRemovedEvent = TaskRemovedEvent
export type DownloadAttentionEvent = TaskAttention
export type DownloadEventHandlers = DownloaderEventHandlers

/** Keeps the native SDK boundary out of stores and components. */
export const downloaderClient = Downloader.get()