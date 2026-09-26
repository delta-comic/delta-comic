import { withDiagnostic, type DiagnosticRecorder } from '@delta-comic/both'
import {
  Downloader,
  type CreateDownloaderOptions,
  type DownloaderEventHandlers,
  type DownloaderUnlisten,
} from '@delta-comic/downloader'

export interface ClientDownloader {
  readonly key: string
  downloadEphemeral(
    url: string,
    options?: Parameters<Downloader['downloadEphemeral']>[1],
  ): ReturnType<Downloader['downloadEphemeral']>
  storeSecret(value: string): ReturnType<Downloader['storeSecret']>
  deleteSecret(secretRef: string): ReturnType<Downloader['deleteSecret']>
  listTasks: Downloader['listTasks']
  getTask: Downloader['getTask']
  getTaskDetail: Downloader['getTaskDetail']
  getCollections: Downloader['getCollections']
  listDestinations: Downloader['listDestinations']
  getSettings: Downloader['getSettings']
  getCapabilities: Downloader['getCapabilities']
  updateSettings: Downloader['updateSettings']
  enqueueUrl: Downloader['enqueueUrl']
  enqueueTorrent: Downloader['enqueueTorrent']
  enqueuePlan: Downloader['enqueuePlan']
  pauseTask: Downloader['pauseTask']
  resumeTask: Downloader['resumeTask']
  retryTask: Downloader['retryTask']
  cancelTask: Downloader['cancelTask']
  forgetTask: Downloader['forgetTask']
  deleteTaskFiles: Downloader['deleteTaskFiles']
  setPriority: Downloader['setPriority']
  moveQueue: Downloader['moveQueue']
  pickDestination: Downloader['pickDestination']
  updateSource: Downloader['updateSource']
  listen(handlers: DownloaderEventHandlers): Promise<DownloaderUnlisten>
  dispose(): void
}

const instrument =
  <Args extends unknown[], Result>(
    downloader: Downloader,
    diagnostics: DiagnosticRecorder,
    pluginId: string,
    name: string,
    method: (...args: Args) => Result,
  ): ((...args: Args) => Result) =>
  (...args) =>
    withDiagnostic(diagnostics, `client downloader ${name}`, () => method.apply(downloader, args), {
      pluginId,
    })

export const createClientDownloader = (
  diagnostics: DiagnosticRecorder,
  pluginId: string,
  options: CreateDownloaderOptions = {},
): ClientDownloader => {
  const downloader = Downloader.create(options)
  return {
    key: downloader.key,
    downloadEphemeral: instrument(
      downloader,
      diagnostics,
      pluginId,
      'download ephemeral',
      downloader.downloadEphemeral,
    ),
    storeSecret: instrument(
      downloader,
      diagnostics,
      pluginId,
      'store secret',
      downloader.storeSecret,
    ),
    deleteSecret: instrument(
      downloader,
      diagnostics,
      pluginId,
      'delete secret',
      downloader.deleteSecret,
    ),
    listTasks: instrument(downloader, diagnostics, pluginId, 'list tasks', downloader.listTasks),
    getTask: instrument(downloader, diagnostics, pluginId, 'get task', downloader.getTask),
    getTaskDetail: instrument(
      downloader,
      diagnostics,
      pluginId,
      'get task detail',
      downloader.getTaskDetail,
    ),
    getCollections: instrument(
      downloader,
      diagnostics,
      pluginId,
      'get collections',
      downloader.getCollections,
    ),
    listDestinations: instrument(
      downloader,
      diagnostics,
      pluginId,
      'list destinations',
      downloader.listDestinations,
    ),
    getSettings: instrument(
      downloader,
      diagnostics,
      pluginId,
      'get settings',
      downloader.getSettings,
    ),
    getCapabilities: instrument(
      downloader,
      diagnostics,
      pluginId,
      'get capabilities',
      downloader.getCapabilities,
    ),
    updateSettings: instrument(
      downloader,
      diagnostics,
      pluginId,
      'update settings',
      downloader.updateSettings,
    ),
    enqueueUrl: instrument(downloader, diagnostics, pluginId, 'enqueue url', downloader.enqueueUrl),
    enqueueTorrent: instrument(
      downloader,
      diagnostics,
      pluginId,
      'enqueue torrent',
      downloader.enqueueTorrent,
    ),
    enqueuePlan: instrument(
      downloader,
      diagnostics,
      pluginId,
      'enqueue plan',
      downloader.enqueuePlan,
    ),
    pauseTask: instrument(downloader, diagnostics, pluginId, 'pause task', downloader.pauseTask),
    resumeTask: instrument(downloader, diagnostics, pluginId, 'resume task', downloader.resumeTask),
    retryTask: instrument(downloader, diagnostics, pluginId, 'retry task', downloader.retryTask),
    cancelTask: instrument(downloader, diagnostics, pluginId, 'cancel task', downloader.cancelTask),
    forgetTask: instrument(downloader, diagnostics, pluginId, 'forget task', downloader.forgetTask),
    deleteTaskFiles: instrument(
      downloader,
      diagnostics,
      pluginId,
      'delete task files',
      downloader.deleteTaskFiles,
    ),
    setPriority: instrument(
      downloader,
      diagnostics,
      pluginId,
      'set priority',
      downloader.setPriority,
    ),
    moveQueue: instrument(downloader, diagnostics, pluginId, 'move queue', downloader.moveQueue),
    pickDestination: instrument(
      downloader,
      diagnostics,
      pluginId,
      'pick destination',
      downloader.pickDestination,
    ),
    updateSource: instrument(
      downloader,
      diagnostics,
      pluginId,
      'update source',
      downloader.updateSource,
    ),
    listen: handlers => downloader.listen(handlers),
    dispose: () => downloader.dispose(),
  }
}