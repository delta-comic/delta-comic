import { defaultServerRuntimeConfig } from '@delta-comic/server-config'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { joinUrl, trimTrailingSlash } from '@/utils/url'

const storageKey = 'delta-comic.server-admin.config'

const readStoredApiBaseUrl = () => {
  if (typeof localStorage == 'undefined') return ''
  return localStorage.getItem(storageKey) ?? ''
}

export const useAdminStore = defineStore('serverAdmin', () => {
  const apiBaseUrl = ref(
    trimTrailingSlash(import.meta.env.VITE_SERVER_API_BASE_URL || readStoredApiBaseUrl()),
  )
  const isConfigured = computed(() => apiBaseUrl.value.length > 0)

  const setApiBaseUrl = (value: string) => {
    apiBaseUrl.value = trimTrailingSlash(value.trim())
    if (typeof localStorage != 'undefined') localStorage.setItem(storageKey, apiBaseUrl.value)
  }

  const endpoint = (path: string) => joinUrl(apiBaseUrl.value, path)

  return {
    apiBaseUrl,
    docsPath: defaultServerRuntimeConfig.docsPath,
    healthPath: defaultServerRuntimeConfig.healthPath,
    openapiJsonPath: defaultServerRuntimeConfig.openapiJsonPath,
    isConfigured,
    setApiBaseUrl,
    endpoint,
  }
})
