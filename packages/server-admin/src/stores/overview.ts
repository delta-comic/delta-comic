import { acceptHMRUpdate, defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { readableApiError } from '@/shared/api/AdminApiClient'
import type { AdminOverview } from '@/shared/api/types'

import { useConnectionStore } from './connection'

export const useOverviewStore = defineStore('serverOverview', () => {
  const connection = useConnectionStore()
  const data = shallowRef<AdminOverview | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef('')

  const load = async (): Promise<void> => {
    if (!connection.hasCredentials) {
      error.value = '请先配置服务器连接'
      return
    }
    loading.value = true
    error.value = ''
    try {
      data.value = await connection.createClient().get<AdminOverview>('/api/admin/overview')
    } catch (cause) {
      error.value = readableApiError(cause)
    } finally {
      loading.value = false
    }
  }

  return { data, error, load, loading }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useOverviewStore, import.meta.hot))