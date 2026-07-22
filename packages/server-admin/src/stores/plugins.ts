import { logger } from '@delta-comic/logger'
import type {
  ServerPluginAction,
  ServerPluginConfig,
  ServerPluginJob,
  ServerPluginSnapshot,
  ServerPluginSnapshotEntry,
  ServerPluginScript,
  ServerPluginScriptRun,
} from '@delta-comic/server'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { readableApiError } from '@/shared/api/AdminApiClient'

import { useConnectionStore } from './connection'

const pluginsLogger = logger.scoped('server-admin:store:plugins')

export const usePluginsStore = defineStore('serverPlugins', () => {
  const connection = useConnectionStore()
  const snapshot = shallowRef<ServerPluginSnapshot | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef('')
  const selectedId = shallowRef('')
  const pending = shallowRef<Record<string, ServerPluginAction>>({})
  const script = shallowRef<ServerPluginScript | null>(null)
  const scriptRuns = shallowRef<ServerPluginScriptRun[]>([])
  const scriptPending = shallowRef(false)

  const plugins = computed(() => snapshot.value?.plugins ?? [])
  const available = computed(() => plugins.value.filter(plugin => !plugin.installedVersion))
  const installed = computed(() => plugins.value.filter(plugin => Boolean(plugin.installedVersion)))
  const selected = computed<ServerPluginSnapshotEntry | undefined>(() =>
    plugins.value.find(plugin => plugin.manifest.id === selectedId.value),
  )

  const load = async (): Promise<void> => {
    if (!connection.hasCredentials) {
      error.value = '请先配置服务器连接'
      pluginsLogger.warn('plugin snapshot load skipped because credentials are incomplete')
      return
    }
    loading.value = true
    error.value = ''
    try {
      snapshot.value = await connection
        .createClient()
        .get<ServerPluginSnapshot>('/api/admin/plugins')
      if (selectedId.value && !selected.value) selectedId.value = ''
      pluginsLogger.debug('plugin snapshot loaded', { count: snapshot.value.plugins.length })
    } catch (cause) {
      error.value = readableApiError(cause)
      pluginsLogger.error('plugin snapshot load failed', { error: error.value })
    } finally {
      loading.value = false
    }
  }

  const setPending = (pluginId: string, action?: ServerPluginAction) => {
    const next = { ...pending.value }
    if (action) next[pluginId] = action
    else delete next[pluginId]
    pending.value = next
  }

  const runAction = async (
    pluginId: string,
    action: ServerPluginAction,
    config?: ServerPluginConfig,
  ): Promise<ServerPluginJob | undefined> => {
    pluginsLogger.info('plugin action requested', { action, pluginId })
    setPending(pluginId, action)
    error.value = ''
    try {
      const client = connection.createClient()
      const path = `/api/admin/plugins/${encodeURIComponent(pluginId)}`
      const job =
        action === 'configure'
          ? await client.patch<ServerPluginJob>(`${path}/config`, { config: config ?? {} })
          : action === 'uninstall'
            ? await client.delete<ServerPluginJob>(path)
            : await client.post<ServerPluginJob>(`${path}/${action}`)
      const jobError = job.status === 'failed' ? (job.errorMessage ?? `${action} 操作失败`) : ''
      await load()
      if (jobError) {
        error.value = jobError
        pluginsLogger.warn('plugin action completed with failed job', {
          action,
          jobId: job.id,
          pluginId,
        })
      } else {
        pluginsLogger.info('plugin action completed', { action, jobId: job.id, pluginId })
      }
      return job
    } catch (cause) {
      error.value = readableApiError(cause)
      pluginsLogger.error('plugin action request failed', { action, error: error.value, pluginId })
      return undefined
    } finally {
      setPending(pluginId)
    }
  }

  const select = (pluginId: string) => {
    selectedId.value = pluginId
  }

  const loadScript = async (pluginId: string): Promise<void> => {
    scriptPending.value = true
    error.value = ''
    try {
      const client = connection.createClient()
      const path = `/api/admin/plugins/${encodeURIComponent(pluginId)}/script`
      const [nextScript, nextRuns] = await Promise.all([
        client.get<ServerPluginScript | null>(path),
        client.get<ServerPluginScriptRun[]>(`${path}/runs`),
      ])
      script.value = nextScript
      scriptRuns.value = nextRuns
      pluginsLogger.debug('plugin script state loaded', {
        pluginId,
        runCount: nextRuns.length,
        scriptConfigured: nextScript !== null,
      })
    } catch (cause) {
      error.value = readableApiError(cause)
      pluginsLogger.error('plugin script state load failed', { error: error.value, pluginId })
    } finally {
      scriptPending.value = false
    }
  }

  const saveScript = async (
    pluginId: string,
    input: Pick<ServerPluginScript, 'enabled' | 'intervalHours' | 'source'>,
  ): Promise<boolean> => {
    scriptPending.value = true
    error.value = ''
    try {
      const path = `/api/admin/plugins/${encodeURIComponent(pluginId)}/script`
      script.value = await connection.createClient().put<ServerPluginScript>(path, input)
      await loadScript(pluginId)
      pluginsLogger.info('plugin script configuration saved', {
        enabled: input.enabled,
        intervalHours: input.intervalHours,
        pluginId,
      })
      return true
    } catch (cause) {
      error.value = readableApiError(cause)
      pluginsLogger.error('plugin script configuration save failed', {
        error: error.value,
        pluginId,
      })
      return false
    } finally {
      scriptPending.value = false
    }
  }

  const runScript = async (
    pluginId: string,
    input: unknown,
  ): Promise<ServerPluginScriptRun | null> => {
    scriptPending.value = true
    error.value = ''
    try {
      const path = `/api/admin/plugins/${encodeURIComponent(pluginId)}/script/run`
      const result = await connection.createClient().post<ServerPluginScriptRun>(path, { input })
      await loadScript(pluginId)
      pluginsLogger.info('manual plugin script run completed', {
        pluginId,
        runId: result.id,
        status: result.status,
      })
      return result
    } catch (cause) {
      error.value = readableApiError(cause)
      pluginsLogger.error('manual plugin script run failed', { error: error.value, pluginId })
      return null
    } finally {
      scriptPending.value = false
    }
  }

  return {
    available,
    error,
    installed,
    load,
    loading,
    pending,
    plugins,
    runAction,
    runScript,
    saveScript,
    script,
    scriptPending,
    scriptRuns,
    loadScript,
    select,
    selected,
    selectedId,
    snapshot,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePluginsStore, import.meta.hot))