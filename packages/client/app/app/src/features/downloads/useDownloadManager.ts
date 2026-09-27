import { logger } from '@delta-comic/logger'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'

import { useDownloadsStore } from '@/stores/downloads'

import type { DownloadTask } from './downloaderClient'
import { activeDownloadStatuses } from './format'

const downloadManagerLogger = logger.scoped('app:downloads:manager')

export type DownloadFilter = 'active' | 'all' | 'completed' | 'failed'

export function useDownloadManager() {
  const store = useDownloadsStore()
  const { tasks } = storeToRefs(store)
  const query = shallowRef('')
  const filter = shallowRef<DownloadFilter>('all')

  const filteredTasks = computed(() => {
    const normalizedQuery = query.value.trim().toLocaleLowerCase()
    return tasks.value.filter(task => {
      if (filter.value === 'active' && !activeDownloadStatuses.has(task.status)) return false
      if (filter.value === 'completed' && task.status !== 'completed') return false
      if (
        filter.value === 'failed' &&
        !(['failed', 'waitingForNetwork', 'waitingForSource'] as DownloadTask['status'][]).includes(
          task.status,
        )
      )
        return false
      if (!normalizedQuery) return true
      return `${task.title} ${task.relativePath}`.toLocaleLowerCase().includes(normalizedQuery)
    })
  })

  const handleVisibility = () => {
    if (document.visibilityState === 'visible')
      void store.refresh().catch(error => {
        downloadManagerLogger.warn('visible-state refresh failed', error)
      })
  }

  onMounted(() => {
    void store.connect().catch(error => {
      downloadManagerLogger.error('download manager connection failed', error)
    })
    document.addEventListener('visibilitychange', handleVisibility)
  })
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibility)
    store.disconnect()
  })

  return { filter, filteredTasks, query, store }
}