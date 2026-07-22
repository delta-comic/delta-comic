import { isTauri } from '@tauri-apps/api/core'
import { listen, TauriEvent, type UnlistenFn } from '@tauri-apps/api/event'
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDownloadsStore } from '@/stores/downloads'

import { createDownloadAttentionReporter } from './attention'

export function useDownloadLifecycle() {
  const store = useDownloadsStore()
  const { t } = useI18n()
  let unlistenResume: UnlistenFn | undefined
  let disposed = false
  const reportAttention = createDownloadAttentionReporter(messageKey => {
    window.$message.warning(t(messageKey))
  })

  watch(
    () => store.attention,
    attention => {
      if (attention) reportAttention(attention.code)
    },
  )

  const refreshSnapshot = () => {
    if (!disposed) void store.refresh().catch(() => undefined)
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') refreshSnapshot()
  }

  onMounted(() => {
    disposed = false
    void store.connect().catch(() => undefined)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', refreshSnapshot)
    window.addEventListener('pageshow', refreshSnapshot)

    if (isTauri()) {
      void listen(TauriEvent.WINDOW_RESUMED, refreshSnapshot)
        .then(unlisten => {
          if (disposed) unlisten()
          else unlistenResume = unlisten
        })
        .catch(() => undefined)
    }
  })

  onUnmounted(() => {
    disposed = true
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', refreshSnapshot)
    window.removeEventListener('pageshow', refreshSnapshot)
    unlistenResume?.()
    unlistenResume = undefined
    store.disconnect()
  })

  return store
}