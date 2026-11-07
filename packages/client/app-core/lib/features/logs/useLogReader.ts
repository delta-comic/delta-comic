import { logger } from '@delta-comic/logger'
import { computed, onMounted, readonly, shallowRef } from 'vue'

import { loggerClient, type LogReaderClient } from './loggerClient'
import { filterLogContent, type LogFileInfo, type LogLevelFilter } from './model'

const logReaderLogger = logger.scoped('app:settings:logs')

export interface UseLogReaderOptions {
  client?: LogReaderClient
  immediate?: boolean
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const useLogReader = (options: UseLogReaderOptions = {}) => {
  const client = options.client ?? loggerClient
  const files = shallowRef<LogFileInfo[]>([])
  const selectedPath = shallowRef<string>()
  const selectedLog = shallowRef<string>('')
  const selectedLogTruncated = shallowRef(false)
  const level = shallowRef<LogLevelFilter>('all')
  const scopeQuery = shallowRef('')
  const loadingFiles = shallowRef(false)
  const loadingContent = shallowRef(false)
  const exporting = shallowRef(false)
  const error = shallowRef<string>()
  const exportPath = shallowRef<string>()
  let readRequest = 0

  const selectedFile = computed(() => files.value.find(file => file.path === selectedPath.value))
  const filteredContent = computed(() =>
    filterLogContent(selectedLog.value, level.value, scopeQuery.value),
  )
  const hasActiveFilter = computed(() => level.value !== 'all' || scopeQuery.value.trim() !== '')

  const selectFile = async (path: string) => {
    if (path === selectedPath.value && selectedLog.value) return
    const request = ++readRequest
    selectedPath.value = path
    selectedLog.value = ''
    selectedLogTruncated.value = false
    loadingContent.value = true
    error.value = undefined

    try {
      const result = await client.readLogFile(path)
      if (request !== readRequest) return
      selectedLog.value = result.content
      selectedLogTruncated.value = result.truncated
      logReaderLogger.debug('log file loaded', {
        path,
        size: result.size,
        truncated: result.truncated,
      })
    } catch (cause) {
      if (request === readRequest) {
        error.value = errorMessage(cause)
        logReaderLogger.error('failed to read log file', { path }, cause)
      }
    } finally {
      if (request === readRequest) loadingContent.value = false
    }
  }

  const refresh = async () => {
    loadingFiles.value = true
    error.value = undefined
    exportPath.value = undefined

    try {
      files.value = [...(await client.listLogFiles())].sort(
        (left, right) => right.modifiedAt - left.modifiedAt,
      )
      logReaderLogger.debug('log file list refreshed', { fileCount: files.value.length })
      const nextPath = files.value.some(file => file.path === selectedPath.value)
        ? selectedPath.value
        : files.value[0]?.path

      if (!nextPath) {
        ++readRequest
        selectedPath.value = undefined
        selectedLog.value = ''
        selectedLogTruncated.value = false
        loadingContent.value = false
      } else {
        selectedPath.value = undefined
        await selectFile(nextPath)
      }
    } catch (cause) {
      error.value = errorMessage(cause)
      logReaderLogger.error('failed to list log files', cause)
    } finally {
      loadingFiles.value = false
    }
  }

  const exportAll = async () => {
    if (exporting.value) return
    exporting.value = true
    error.value = undefined
    exportPath.value = undefined
    try {
      exportPath.value = await client.exportLogs(files.value.map(file => file.path))
      logReaderLogger.info('logs exported', {
        fileCount: files.value.length,
        path: exportPath.value,
      })
    } catch (cause) {
      error.value = errorMessage(cause)
      logReaderLogger.error('failed to export logs', cause)
    } finally {
      exporting.value = false
    }
  }

  const setLevel = (value: LogLevelFilter) => {
    level.value = value
  }

  const setScopeQuery = (value: string) => {
    scopeQuery.value = value
  }

  const clearError = () => {
    error.value = undefined
  }

  if (options.immediate !== false) onMounted(() => void refresh())

  return {
    clearError,
    error: readonly(error),
    exportAll,
    exporting: readonly(exporting),
    exportPath: readonly(exportPath),
    files: readonly(files),
    filteredContent,
    hasActiveFilter,
    level: readonly(level),
    loadingContent: readonly(loadingContent),
    loadingFiles: readonly(loadingFiles),
    refresh,
    scopeQuery: readonly(scopeQuery),
    selectFile,
    selectedFile,
    selectedLogTruncated: readonly(selectedLogTruncated),
    selectedPath: readonly(selectedPath),
    setLevel,
    setScopeQuery,
  }
}