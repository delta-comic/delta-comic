<script setup lang="ts">
import { SharedFunction } from '@delta-comic/core'
import { Global } from '@delta-comic/plugin'
import * as Clipboard from '@tauri-apps/plugin-clipboard-manager'
import { useIntervalFn } from '@vueuse/core'
import { Mutex } from 'es-toolkit'
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { pluginName } from './symbol'
const $router = useRouter()
const $route = useRoute()

await $router.push($route.fullPath)

const scanned = new Set<string>()
SharedFunction.define(
  async token => {
    await Clipboard.writeText(token)
    scanned.add(token)
    window.$message.success('复制成功')
  },
  pluginName,
  'pushShareToken'
)

const handleShareTokenCheck = async () => {
  try {
    const chipText = await Clipboard.readText()
    if (scanned.has(chipText)) return
    scanned.add(chipText)
    const handlers = Array.from(Global.shareToken.values()).filter(v => v.patten(chipText))
    console.log('new chipText discovery', chipText, handlers)
    const lock = new Mutex()
    for (const handler of handlers) {
      await lock.acquire()
      const detail = await handler.show(chipText)
      window.$dialog.info({
        title: `口令探测：${detail.title}`,
        content: detail.detail,
        closeOnEsc: false,
        maskClosable: false,
        closable: false,
        positiveText: '查看',
        negativeText: '取消',
        onPositiveClick() {
          detail.onPositive()
          lock.release()
        },
        onNegativeClick() {
          detail.onNegative()
          lock.release()
        }
      })
    }
  } catch {}
}
// App.addListener('resume', handleShareTokenCheck)
onMounted(handleShareTokenCheck)
useIntervalFn(handleShareTokenCheck, 2000)
</script>

<template>
  <RouterView :key="$route.meta.force ? $route.fullPath : undefined" v-slot="{ Component }">
    <component :is="Component" />
  </RouterView>
</template>