import {
  cancelTask,
  deleteTaskFiles,
  enqueuePlan,
  enqueueTorrent,
  enqueueUrl,
  forgetTask,
  getCapabilities,
  getCollections,
  getSettings,
  getTask,
  getTaskDetail,
  listDestinations,
  listTasks,
  listenDownloaderEvents,
  moveQueue,
  pauseTask,
  pickDestination,
  resumeTask,
  retryTask,
  setPriority,
  updateSource,
  updateSettings,
  type ContentRefreshContext,
  type DownloadTask,
  type DownloadTaskDetail,
  type DownloadCollection,
  type DownloadSource,
  type Destination,
  type DownloaderSettings,
  type DownloaderCapabilities,
  type EnqueuePlanInput,
  type EnqueueTorrentInput,
  type EnqueueUrlInput,
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

export interface DownloadTaskUpsertEvent {
  revision: number
  task: DownloadTask
}

export interface DownloadTaskRemovedEvent {
  revision: number
  taskId: string
}

export interface DownloadAttentionEvent {
  code: string
  message: string
  revision: number
  taskId: string
}

export interface DownloadEventHandlers {
  attention?: (event: DownloadAttentionEvent) => void
  removed?: (event: DownloadTaskRemovedEvent) => void
  upsert?: (event: DownloadTaskUpsertEvent) => void
}

/** Keeps the native SDK boundary out of stores and components. */
export const downloaderClient = {
  cancelTask,
  deleteTaskFiles,
  enqueuePlan,
  enqueueTorrent,
  enqueueUrl,
  forgetTask,
  getCollections,
  getCapabilities,
  getSettings,
  getTask,
  getTaskDetail,
  listDestinations,
  listTasks,
  listen(handlers: DownloadEventHandlers) {
    return listenDownloaderEvents(handlers)
  },
  moveQueue,
  pauseTask,
  pickDestination,
  resumeTask,
  retryTask,
  setPriority,
  updateSource,
  updateSettings,
}