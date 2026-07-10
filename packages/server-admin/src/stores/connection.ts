import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { AdminApiClient, readableApiError } from '@/shared/api/AdminApiClient'
import type { AdminCapabilities } from '@/shared/api/types'
import { normalizeApiBaseUrl } from '@/utils/url'

const endpointStorageKey = 'delta-comic.server-admin.endpoint'
const tokenStorageKey = 'delta-comic.server-admin.token'

const browserStorage = (kind: 'local' | 'session'): Storage | undefined => {
  if (typeof window === 'undefined') return undefined
  return kind === 'local' ? window.localStorage : window.sessionStorage
}

const readEndpoint = (): string => {
  const configured = import.meta.env.VITE_SERVER_API_BASE_URL?.trim()
  const stored = browserStorage('local')?.getItem(endpointStorageKey) ?? ''
  try {
    return normalizeApiBaseUrl(configured || stored)
  } catch {
    return ''
  }
}

export const useConnectionStore = defineStore('serverConnection', () => {
  const apiBaseUrl = shallowRef(readEndpoint())
  const adminToken = shallowRef(browserStorage('session')?.getItem(tokenStorageKey) ?? '')
  const status = shallowRef<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected')
  const error = shallowRef('')
  const capabilities = shallowRef<AdminCapabilities | null>(null)

  const hasCredentials = computed(
    () => apiBaseUrl.value.length > 0 && adminToken.value.trim().length > 0,
  )
  const isConnected = computed(() => status.value === 'connected')

  const createClient = (): AdminApiClient => {
    if (!apiBaseUrl.value) throw new Error('请先配置 Server API 地址')
    return new AdminApiClient({ baseUrl: apiBaseUrl.value, getToken: () => adminToken.value })
  }

  const saveCredentials = (endpoint: string, token: string) => {
    apiBaseUrl.value = normalizeApiBaseUrl(endpoint)
    adminToken.value = token.trim()
    browserStorage('local')?.setItem(endpointStorageKey, apiBaseUrl.value)
    const session = browserStorage('session')
    if (adminToken.value) session?.setItem(tokenStorageKey, adminToken.value)
    else session?.removeItem(tokenStorageKey)
    status.value = 'disconnected'
    capabilities.value = null
    error.value = ''
  }

  const clearToken = () => {
    adminToken.value = ''
    browserStorage('session')?.removeItem(tokenStorageKey)
    status.value = 'disconnected'
    capabilities.value = null
  }

  const connect = async (): Promise<boolean> => {
    if (!hasCredentials.value) {
      status.value = 'disconnected'
      error.value = '请先在设置中填写 API 地址和管理员令牌'
      return false
    }
    status.value = 'connecting'
    error.value = ''
    try {
      capabilities.value = await createClient().get<AdminCapabilities>('/api/admin/capabilities')
      status.value = 'connected'
      return true
    } catch (cause) {
      status.value = 'error'
      error.value = readableApiError(cause)
      capabilities.value = null
      return false
    }
  }

  return {
    adminToken,
    apiBaseUrl,
    capabilities,
    clearToken,
    connect,
    createClient,
    error,
    hasCredentials,
    isConnected,
    saveCredentials,
    status,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useConnectionStore, import.meta.hot))