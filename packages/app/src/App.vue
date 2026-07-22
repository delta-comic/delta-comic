<script setup lang="ts">
import { logger } from '@delta-comic/logger'
import { Global } from '@delta-comic/plugin'
import { SharedFunction } from '@delta-comic/utils'
import { useIntervalFn } from '@vueuse/core'
import { Mutex } from 'es-toolkit'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'

import { useDownloadLifecycle } from './features/downloads/useDownloadLifecycle'
import { readClipboardText, writeClipboardText } from './platform'
import { pluginName } from './symbol'

const appShellLogger = logger.scoped('app:shell')
const $router = useRouter()
const $route = useRoute()
const { t } = useI18n()
useDownloadLifecycle()

await $router.push($route.fullPath)

const scanned = new Set<string>()
SharedFunction.define(
  async token => {
    await writeClipboardText(token)
    scanned.add(token)
    window.$message.success(t('common.feedback.copied'))
  },
  pluginName,
  'pushShareToken',
)

const handleShareTokenCheck = async () => {
  try {
    const chipText = await readClipboardText()
    if (scanned.has(chipText)) return
    scanned.add(chipText)
    const handlers = Array.from(Global.shareToken.values()).filter(v => v.patten(chipText))
    appShellLogger.debug('share token handlers matched', { handlerCount: handlers.length })
    const lock = new Mutex()
    for (const handler of handlers) {
      await lock.acquire()
      const detail = await handler.show(chipText)
      window.$dialog.info({
        title: t('share.tokenDetected', { title: detail.title }),
        content: detail.detail,
        closeOnEsc: false,
        maskClosable: false,
        closable: false,
        positiveText: t('common.actions.view'),
        negativeText: t('common.actions.cancel'),
        onPositiveClick() {
          detail.onPositive()
          lock.release()
        },
        onNegativeClick() {
          detail.onNegative()
          lock.release()
        },
      })
    }
  } catch (error) {
    appShellLogger.debug('clipboard share-token scan skipped', error)
  }
}
// App.addListener('resume', handleShareTokenCheck)
onMounted(() => {
  appShellLogger.info('application shell mounted')
  void handleShareTokenCheck()
})
useIntervalFn(handleShareTokenCheck, 2000)
</script>

<template>
  <RouterView :key="$route.meta.force ? $route.fullPath : undefined" v-slot="{ Component }">
    <component :is="Component" />
  </RouterView>
</template>