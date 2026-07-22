import { uni } from '@delta-comic/model'
import { usePluginStore } from '@delta-comic/plugin'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { getPluginDownloadIdentity } from '@/features/downloads/contentPlan'
import {
  isContentSourceRefreshCandidateCurrent,
  prepareContentSourceRefresh,
  type ContentSourceRefreshCandidate,
} from '@/features/downloads/contentSourceRefresh'
import {
  downloaderClient,
  type Destination,
  type DownloadAttentionEvent,
  type DownloadCollection,
  type DownloadTask,
  type DownloadTaskDetail,
  type DownloadTaskRemovedEvent,
  type DownloadTaskUpsertEvent,
  type DownloaderCapabilities,
  type DownloaderSettings,
  type EnqueuePlanInput,
  type EnqueueTorrentInput,
  type EnqueueUrlInput,
} from '@/features/downloads/downloaderClient'
import { activeDownloadStatuses } from '@/features/downloads/format'
import {
  sourceRefreshChangeToken,
  sourceRefreshReasonForAttention,
  type SourceRefreshWarning,
  type SourceRefreshWarningStatus,
} from '@/features/downloads/sourceRefresh'

const DEFAULT_SETTINGS: DownloaderSettings = {
  allowMetered: true,
  connectionBudget: 16,
  maxActiveTasks: 4,
  perTaskConnections: 8,
  revision: 0,
  seedOnComplete: false,
  seedRatio: undefined,
  seedSeconds: undefined,
}

const DEFAULT_CAPABILITIES: DownloaderCapabilities = { connectionBudgetMax: 64, maxActiveTasks: 20 }

function compareTasks(left: DownloadTask, right: DownloadTask) {
  return right.priority - left.priority || left.queuePosition - right.queuePosition
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export const useDownloadsStore = defineStore('downloads', () => {
  const tasks = shallowRef<DownloadTask[]>([])
  const collections = shallowRef<DownloadCollection[]>([])
  const capabilities = shallowRef<DownloaderCapabilities>({ ...DEFAULT_CAPABILITIES })
  const destinations = shallowRef<Destination[]>([])
  const settings = shallowRef<DownloaderSettings>({ ...DEFAULT_SETTINGS })
  const loading = shallowRef(false)
  const mutating = shallowRef(false)
  const error = shallowRef<string>()
  const selectedTaskId = shallowRef<string>()
  const selectedTaskDetail = shallowRef<DownloadTaskDetail>()
  const revision = shallowRef(0)
  const attention = shallowRef<DownloadAttentionEvent>()
  const sourceRefreshWarnings = shallowRef<SourceRefreshWarning[]>([])
  const pluginStore = usePluginStore()

  const activeTasks = computed(() =>
    tasks.value.filter(task => activeDownloadStatuses.has(task.status)),
  )
  const pausableTasks = computed(() =>
    tasks.value.filter(task => task.status === 'queued' || activeDownloadStatuses.has(task.status)),
  )
  const aggregateSpeed = computed(() =>
    activeTasks.value.reduce((total, task) => total + task.speedBytesPerSecond, 0),
  )
  const selectedTask = computed(() => tasks.value.find(task => task.id === selectedTaskId.value))

  let references = 0
  let connectionGeneration = 0
  let connectPromise: Promise<void> | undefined
  let refreshPromise: Promise<void> | undefined
  let unlisten: (() => void) | undefined
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let detailTimer: ReturnType<typeof setTimeout> | undefined
  let detailRequest = 0
  let sourceRefreshPromise: Promise<void> | undefined
  let sourceRefreshPending = false
  let mutationCount = 0
  const sourceRefreshControllers = new Map<string, AbortController>()
  const sourceRefreshFailureRevisions = new Map<string, number>()
  const sourceRefreshAttentionCodes = new Map<string, string>()
  const sourceRefreshApprovals = new Map<string, string>()
  const removedTaskRevisions = new Map<string, number>()

  const sourceRefreshRuntime = {
    isPluginLoaded: (plugin: string) => pluginStore.$isLoaded(plugin),
    getContentPage: (contentType: [string, string]) =>
      uni.content.ContentPage.contentPages.get(contentType),
    getDownloadProvider: (contentType: [string, string]) =>
      uni.content.ContentPage.downloadProviders.get(contentType),
    getPluginIdentity: getPluginDownloadIdentity,
  }

  function setSourceRefreshWarning(
    task: DownloadTask,
    status: SourceRefreshWarningStatus,
    collection?: DownloadCollection,
    changes?: SourceRefreshWarning['changes'],
  ) {
    const warning: SourceRefreshWarning = {
      taskId: task.id,
      taskTitle: task.title,
      collectionTitle: collection?.title,
      status,
      changes,
    }
    const index = sourceRefreshWarnings.value.findIndex(value => value.taskId === task.id)
    if (index < 0) sourceRefreshWarnings.value = [...sourceRefreshWarnings.value, warning]
    else {
      const next = [...sourceRefreshWarnings.value]
      next[index] = warning
      sourceRefreshWarnings.value = next
    }
  }

  function clearSourceRefreshState(taskId: string) {
    sourceRefreshControllers.get(taskId)?.abort()
    sourceRefreshControllers.delete(taskId)
    sourceRefreshWarnings.value = sourceRefreshWarnings.value.filter(
      value => value.taskId !== taskId,
    )
    sourceRefreshFailureRevisions.delete(taskId)
    sourceRefreshAttentionCodes.delete(taskId)
    sourceRefreshApprovals.delete(taskId)
  }

  function applyTask(task: DownloadTask, authoritative = false) {
    const removedRevision = removedTaskRevisions.get(task.id)
    if (removedRevision != null && removedRevision >= task.revision) return false
    if (removedRevision != null) removedTaskRevisions.delete(task.id)
    const index = tasks.value.findIndex(value => value.id === task.id)
    const current = index < 0 ? undefined : tasks.value[index]
    if (
      current &&
      (current.revision > task.revision || (!authoritative && current.revision === task.revision))
    ) {
      return false
    }
    const nextTasks = [...tasks.value]
    if (index < 0) nextTasks.push(task)
    else nextTasks[index] = task
    tasks.value = nextTasks.sort(compareTasks)
    revision.value = Math.max(revision.value, task.revision)
    if (task.status !== 'waitingForSource') clearSourceRefreshState(task.id)
    return true
  }

  function replaceTasks(nextTasks: DownloadTask[], baselineRevision: number) {
    const snapshotIds = new Set(nextTasks.map(task => task.id))
    const currentById = new Map(tasks.value.map(task => [task.id, task]))
    const mergedTasks: DownloadTask[] = []
    for (const task of nextTasks) {
      const removedRevision = removedTaskRevisions.get(task.id)
      if (removedRevision != null && removedRevision >= task.revision) continue
      const current = currentById.get(task.id)
      mergedTasks.push(current && current.revision > task.revision ? current : task)
    }
    for (const task of tasks.value) {
      if (!snapshotIds.has(task.id) && task.revision > baselineRevision) mergedTasks.push(task)
    }
    tasks.value = mergedTasks.sort(compareTasks)
    revision.value = Math.max(revision.value, ...mergedTasks.map(task => task.revision), 0)
    for (const [taskId, removedRevision] of removedTaskRevisions) {
      if (removedRevision <= baselineRevision && !snapshotIds.has(taskId)) {
        removedTaskRevisions.delete(taskId)
      }
    }
    const waitingTaskIds = new Set(
      mergedTasks.filter(task => task.status === 'waitingForSource').map(task => task.id),
    )
    sourceRefreshWarnings.value = sourceRefreshWarnings.value.filter(warning =>
      waitingTaskIds.has(warning.taskId),
    )
    for (const taskId of sourceRefreshFailureRevisions.keys()) {
      const task = mergedTasks.find(value => value.id === taskId)
      if (!task || task.status !== 'waitingForSource') clearSourceRefreshState(taskId)
    }
  }

  async function refreshTaskSource(
    task: DownloadTask,
    collection: DownloadCollection,
    candidate: ContentSourceRefreshCandidate,
  ) {
    if (!task.assetKey || sourceRefreshControllers.has(task.id)) return
    if (!isContentSourceRefreshCandidateCurrent(candidate, sourceRefreshRuntime)) {
      void reconcileSourceRefreshes()
      return
    }
    const controller = new AbortController()
    sourceRefreshControllers.set(task.id, controller)
    try {
      const source = await candidate.provider.refreshSource(
        {
          assetKey: task.assetKey,
          page: candidate.page,
          planKey: collection.key,
          reason: sourceRefreshReasonForAttention(
            sourceRefreshAttentionCodes.get(task.id) ?? task.errorCode ?? 'sourceExpired',
          ),
          source: task.source,
        },
        controller.signal,
      )
      const current = tasks.value.find(value => value.id === task.id)
      if (
        controller.signal.aborted ||
        current?.status !== 'waitingForSource' ||
        current.revision !== task.revision ||
        !isContentSourceRefreshCandidateCurrent(candidate, sourceRefreshRuntime)
      ) {
        if (!controller.signal.aborted) void reconcileSourceRefreshes()
        return
      }
      applyTask(await downloaderClient.updateSource(task.id, source), true)
      clearSourceRefreshState(task.id)
      scheduleRefresh()
    } catch {
      if (controller.signal.aborted) return
      const current = tasks.value.find(value => value.id === task.id)
      if (current?.status !== 'waitingForSource' || current.revision !== task.revision) return
      sourceRefreshFailureRevisions.set(task.id, task.revision)
      setSourceRefreshWarning(task, 'refresh-failed', collection)
    } finally {
      if (sourceRefreshControllers.get(task.id) === controller) {
        sourceRefreshControllers.delete(task.id)
      }
    }
  }

  async function reconcileSourceRefreshTask(task: DownloadTask, force = false) {
    if (task.status !== 'waitingForSource') {
      clearSourceRefreshState(task.id)
      return
    }
    if (!force && sourceRefreshFailureRevisions.get(task.id) === task.revision) return

    const collection = task.collectionKey
      ? collections.value.find(value => value.key === task.collectionKey)
      : undefined
    if (!collection?.refreshContext) {
      setSourceRefreshWarning(task, 'context-missing', collection)
      return
    }
    if (!task.assetKey) {
      setSourceRefreshWarning(task, 'asset-context-missing', collection)
      return
    }

    const result = await prepareContentSourceRefresh(
      collection.refreshContext,
      sourceRefreshRuntime,
    )
    if (
      'candidate' in result &&
      !isContentSourceRefreshCandidateCurrent(result.candidate, sourceRefreshRuntime)
    ) {
      void reconcileSourceRefreshes()
      return
    }
    if (result.status === 'compatible') {
      await refreshTaskSource(task, collection, result.candidate)
      return
    }
    if (result.status === 'confirmation-required') {
      const token = sourceRefreshChangeToken(result.changes)
      if (sourceRefreshApprovals.get(task.id) !== token) {
        setSourceRefreshWarning(task, result.status, collection, result.changes)
        return
      }
      sourceRefreshApprovals.delete(task.id)
      await refreshTaskSource(task, collection, result.candidate)
      return
    }

    setSourceRefreshWarning(task, result.status, collection)
  }

  async function reconcileSourceRefreshes() {
    sourceRefreshPending = true
    if (sourceRefreshPromise) return sourceRefreshPromise
    sourceRefreshPromise = (async () => {
      while (sourceRefreshPending) {
        sourceRefreshPending = false
        const waitingTasks = tasks.value.filter(task => task.status === 'waitingForSource')
        for (const task of waitingTasks) await reconcileSourceRefreshTask(task)
      }
    })().finally(() => {
      sourceRefreshPromise = undefined
    })
    return sourceRefreshPromise
  }

  async function confirmSourceRefresh(taskId: string) {
    await sourceRefreshPromise
    const warning = sourceRefreshWarnings.value.find(value => value.taskId === taskId)
    const task = tasks.value.find(value => value.id === taskId)
    if (!task || warning?.status !== 'confirmation-required' || !warning.changes) return
    sourceRefreshApprovals.set(taskId, sourceRefreshChangeToken(warning.changes))
    sourceRefreshFailureRevisions.delete(taskId)
    await reconcileSourceRefreshTask(task, true)
  }

  async function retrySourceRefresh(taskId: string) {
    await sourceRefreshPromise
    const task = tasks.value.find(value => value.id === taskId)
    if (!task) return
    sourceRefreshFailureRevisions.delete(taskId)
    await reconcileSourceRefreshTask(task, true)
  }

  watch(
    () => [...pluginStore.ready].sort().join('\u0000'),
    () => {
      sourceRefreshFailureRevisions.clear()
      for (const controller of sourceRefreshControllers.values()) controller.abort()
      void reconcileSourceRefreshes()
    },
  )

  async function refresh(freshAfterPending = false): Promise<void> {
    if (refreshPromise) {
      const pending = refreshPromise
      await pending
      if (freshAfterPending) return await refresh()
      return
    }
    const baselineRevision = revision.value
    loading.value = true
    refreshPromise = Promise.all([
      downloaderClient.listTasks(),
      downloaderClient.getCapabilities(),
      downloaderClient.getSettings(),
      downloaderClient.getCollections(),
      downloaderClient.listDestinations(),
    ])
      .then(([nextTasks, nextCapabilities, nextSettings, nextCollections, nextDestinations]) => {
        replaceTasks(nextTasks, baselineRevision)
        capabilities.value = nextCapabilities
        settings.value = nextSettings
        collections.value = nextCollections
        destinations.value = nextDestinations
        revision.value = Math.max(revision.value, nextSettings.revision)
        error.value = undefined
        void reconcileSourceRefreshes()
      })
      .catch(cause => {
        error.value = errorMessage(cause)
        throw cause
      })
      .finally(() => {
        loading.value = false
        refreshPromise = undefined
      })
    return refreshPromise
  }

  function scheduleRefresh() {
    if (refreshTimer) return
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined
      void refresh().catch(() => undefined)
    }, 250)
  }

  async function loadTaskDetail(id: string) {
    const request = ++detailRequest
    const detail = await downloaderClient.getTaskDetail(id)
    if (request === detailRequest && selectedTaskId.value === id) selectedTaskDetail.value = detail
  }

  function scheduleDetailRefresh() {
    if (!selectedTaskId.value || detailTimer) return
    detailTimer = setTimeout(() => {
      detailTimer = undefined
      if (selectedTaskId.value) void loadTaskDetail(selectedTaskId.value).catch(() => undefined)
    }, 500)
  }

  function acceptRevision(nextRevision: number) {
    if (nextRevision <= revision.value) return false
    if (revision.value && nextRevision > revision.value + 1) {
      scheduleRefresh()
    }
    revision.value = nextRevision
    return true
  }

  function handleUpsert(event: DownloadTaskUpsertEvent) {
    const revisionAccepted = acceptRevision(event.revision)
    if (!applyTask(event.task) && !revisionAccepted) return
    if (selectedTaskId.value === event.task.id) {
      if (selectedTaskDetail.value)
        selectedTaskDetail.value = { ...selectedTaskDetail.value, task: event.task }
      scheduleDetailRefresh()
    }
    if (event.task.status === 'waitingForSource') scheduleRefresh()
  }

  function handleRemoved(event: DownloadTaskRemovedEvent) {
    acceptRevision(event.revision)
    const current = tasks.value.find(task => task.id === event.taskId)
    if (current && current.revision > event.revision) return
    if ((removedTaskRevisions.get(event.taskId) ?? 0) >= event.revision) return
    removedTaskRevisions.set(event.taskId, event.revision)
    tasks.value = tasks.value.filter(task => task.id !== event.taskId)
    sourceRefreshControllers.get(event.taskId)?.abort()
    sourceRefreshControllers.delete(event.taskId)
    clearSourceRefreshState(event.taskId)
    if (selectedTaskId.value === event.taskId) selectedTaskId.value = undefined
    if (selectedTaskDetail.value?.task.id === event.taskId) selectedTaskDetail.value = undefined
  }

  function handleAttention(event: DownloadAttentionEvent) {
    attention.value = event
    sourceRefreshAttentionCodes.set(event.taskId, event.code)
    if (!acceptRevision(event.revision)) {
      if (tasks.value.some(task => task.id === event.taskId)) scheduleRefresh()
      return
    }
    scheduleRefresh()
  }

  async function connect() {
    references += 1
    if (references > 1) return await connectPromise
    const generation = ++connectionGeneration
    const operation = (async () => {
      let listenerError: unknown
      try {
        const nextUnlisten = await downloaderClient.listen({
          attention: handleAttention,
          removed: handleRemoved,
          upsert: handleUpsert,
        })
        if (generation !== connectionGeneration || references === 0) nextUnlisten()
        else unlisten = nextUnlisten
      } catch (cause) {
        listenerError = cause
      }
      if (generation !== connectionGeneration || references === 0) return
      try {
        await refresh()
      } catch {
        // Keep the snapshot error while retaining a successful event subscription.
      }
      if (listenerError) error.value ??= errorMessage(listenerError)
    })()
    connectPromise = operation
    try {
      await operation
    } finally {
      if (connectPromise === operation) connectPromise = undefined
    }
  }

  function disconnect() {
    references = Math.max(0, references - 1)
    if (references) return
    connectionGeneration += 1
    unlisten?.()
    unlisten = undefined
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = undefined
    if (detailTimer) clearTimeout(detailTimer)
    detailTimer = undefined
    for (const controller of sourceRefreshControllers.values()) controller.abort()
    sourceRefreshControllers.clear()
  }

  async function mutate<T>(operation: () => Promise<T>) {
    mutationCount += 1
    mutating.value = true
    error.value = undefined
    try {
      const result = await operation()
      await refresh(true)
      return result
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    } finally {
      mutationCount = Math.max(0, mutationCount - 1)
      mutating.value = mutationCount > 0
    }
  }

  const enqueueUrl = (input: EnqueueUrlInput) => mutate(() => downloaderClient.enqueueUrl(input))
  const enqueuePlan = (input: EnqueuePlanInput) => mutate(() => downloaderClient.enqueuePlan(input))
  const enqueueTorrent = (input: EnqueueTorrentInput) =>
    mutate(() => downloaderClient.enqueueTorrent(input))
  const pickDestination = () => mutate(() => downloaderClient.pickDestination())
  const pauseTask = (id: string) => mutate(() => downloaderClient.pauseTask(id))
  const resumeTask = (id: string) => mutate(() => downloaderClient.resumeTask(id))
  const retryTask = (id: string) => mutate(() => downloaderClient.retryTask(id))
  const cancelTask = (id: string) => mutate(() => downloaderClient.cancelTask(id))
  const forgetTask = (id: string) => mutate(() => downloaderClient.forgetTask(id))
  const deleteTaskFiles = (id: string) => mutate(() => downloaderClient.deleteTaskFiles(id))
  const setPriority = (id: string, priority: number) =>
    mutate(() => downloaderClient.setPriority(id, priority))
  const updateSettings = (patch: Partial<DownloaderSettings>) =>
    mutate(async () => {
      settings.value = await downloaderClient.updateSettings(patch)
      return settings.value
    })

  async function pauseAll() {
    await mutate(() =>
      Promise.all(pausableTasks.value.map(task => downloaderClient.pauseTask(task.id))),
    )
  }

  function selectTask(id?: string) {
    selectedTaskId.value = id
    selectedTaskDetail.value = undefined
    detailRequest += 1
    if (id) void loadTaskDetail(id).catch(() => undefined)
  }

  function clearError() {
    error.value = undefined
  }

  return {
    activeTasks,
    aggregateSpeed,
    attention,
    capabilities,
    cancelTask,
    clearError,
    collections,
    confirmSourceRefresh,
    connect,
    deleteTaskFiles,
    destinations,
    disconnect,
    enqueuePlan,
    enqueueTorrent,
    enqueueUrl,
    error,
    forgetTask,
    loading,
    mutating,
    pauseAll,
    pausableTasks,
    pauseTask,
    refresh,
    pickDestination,
    resumeTask,
    retryTask,
    retrySourceRefresh,
    revision,
    selectTask,
    selectedTask,
    selectedTaskDetail,
    selectedTaskId,
    setPriority,
    settings,
    sourceRefreshWarnings,
    tasks,
    updateSettings,
  }
})