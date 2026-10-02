import type { FlowInstallation, FlowRun } from '@delta-comic/server'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { readableApiError } from '@/shared/api/AdminApiClient'

import { useConnectionStore } from './connection'

export const usePluginsStore = defineStore('serverPlugins', () => {
  const connection = useConnectionStore()
  const plugins = shallowRef<FlowInstallation[]>([])
  const selectedId = shallowRef('')
  const selected = computed(() =>
    plugins.value.find(plugin => plugin.manifest.id === selectedId.value),
  )
  const runs = shallowRef<FlowRun[]>([])
  const pending = shallowRef(false)
  const error = shallowRef('')
  const path = (id: string) => `/api/plugins/${encodeURIComponent(id)}`
  const request = async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      return await operation()
    } catch (cause) {
      error.value = readableApiError(cause)
    } finally {
      pending.value = false
    }
  }
  const refresh = async () => {
    plugins.value = await connection.createUserClient().get<FlowInstallation[]>('/api/plugins')
    if (selectedId.value && !selected.value) selectedId.value = ''
    if (selectedId.value)
      runs.value = await connection
        .createUserClient()
        .get<FlowRun[]>(`${path(selectedId.value)}/runs`)
    else runs.value = []
  }
  const load = () => request(refresh)
  const select = async (id: string) => {
    selectedId.value = id
    await load()
  }
  const save = (
    id: string,
    input: {
      manifest: unknown
      source: string
      enabled: boolean
      config: Record<string, unknown>
      schedule?: FlowInstallation['schedule']
    },
  ) =>
    request(async () => {
      const result = await connection.createUserClient().put<FlowInstallation>(path(id), input)
      selectedId.value = id
      await refresh()
      return result
    })
  const configure = (installation: FlowInstallation, enabled: boolean) =>
    request(async () => {
      await connection
        .createUserClient()
        .patch<FlowInstallation>(path(installation.manifest.id), {
          config: installation.config,
          enabled,
          schedule: installation.schedule,
        })
      await refresh()
    })
  const remove = (id: string) =>
    request(async () => {
      await connection.createUserClient().delete(path(id))
      selectedId.value = ''
      runs.value = []
      await refresh()
    })
  const run = (id: string, flowId: string, input: unknown) =>
    request(async () => {
      const result = await connection
        .createUserClient()
        .post<FlowRun>(`${path(id)}/flows/${encodeURIComponent(flowId)}/run`, { input })
      await refresh()
      return result
    })
  return {
    plugins,
    selectedId,
    selected,
    runs,
    pending,
    error,
    load,
    select,
    save,
    configure,
    remove,
    run,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePluginsStore, import.meta.hot))