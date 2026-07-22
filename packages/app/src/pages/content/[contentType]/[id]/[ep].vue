<script setup lang="ts">
import { HistoryDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { usePreventBack } from '@delta-comic/ui'
import { useFullscreen } from '@delta-comic/utils'
import { NButton, NIcon, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import ContentDownloadDialog from '@/components/download/ContentDownloadDialog.vue'
import { contentPlanToEnqueueInput } from '@/features/downloads/contentPlan'
import type { ContentDownloadRequest } from '@/features/downloads/destination'
import { Icons } from '@/icons'
import { useContentStore } from '@/stores/content'
import { useDownloadsStore } from '@/stores/downloads'

definePage({ meta: { statusBar: 'dark', force: true } })
const $route = useRoute<'/content/[contentType]/[id]/[ep]'>()
const ep = $route.params.ep.toString()
const id = $route.params.id.toString()
const contentType = $route.params.contentType

const contentStore = useContentStore()
contentStore.$load(contentType, id, ep)

const page = computed(
  () => contentStore.history.get(contentStore.$createHistoryKey(contentType, id, ep))!,
)

const layout = computed(() => uni.content.ContentPage.layouts.get($route.params.contentType))
const downloadProvider = computed(() =>
  uni.content.ContentPage.downloadProviders.get(page.value.contentType),
)

const { isFullscreen } = useFullscreen()
usePreventBack(isFullscreen)

// history
const { upsert } = HistoryDB.useUpsert()
page.value.fetchDetail().then(item => upsert({ item: item.toJSON() }))

const { t } = useI18n()
const message = useMessage()
const downloads = useDownloadsStore()
const { destinations } = storeToRefs(downloads)
const resolvingDownload = shallowRef(false)
const showDownloadDialog = shallowRef(false)
let downloadController: AbortController | undefined

async function downloadContent(request: ContentDownloadRequest) {
  const provider = downloadProvider.value
  const currentPage = page.value
  if (!provider || resolvingDownload.value) return
  downloadController?.abort()
  const controller = new AbortController()
  downloadController = controller
  resolvingDownload.value = true
  try {
    const plan = await provider.resolve(
      { page: currentPage, selection: request.selection },
      controller.signal,
    )
    controller.signal.throwIfAborted()
    const input = await contentPlanToEnqueueInput(
      plan,
      currentPage,
      request.destinationId,
      provider,
    )
    controller.signal.throwIfAborted()
    await downloads.enqueuePlan(input)
    showDownloadDialog.value = false
    message.success(t('download.messages.added'))
  } catch (error) {
    if (controller.signal.aborted) return
    message.error(
      t('download.errors.actionFailed', {
        error: error instanceof Error ? error.message : String(error),
      }),
    )
  } finally {
    resolvingDownload.value = false
  }
}

onUnmounted(() => downloadController?.abort())
</script>

<template>
  <component :page :is="layout" v-if="layout">
    <template #view="{ item }">
      <component :page :is="page.ViewComponent" :union="item" />
    </template>
  </component>
  <NButton
    v-if="downloadProvider"
    circle
    class="fixed! right-4 bottom-[calc(var(--safe-area-inset-bottom)+1rem)] z-30 shadow-lg"
    :aria-label="t('download.actions.downloadCurrent')"
    :loading="resolvingDownload"
    size="large"
    type="primary"
    @click="showDownloadDialog = true"
  >
    <template #icon>
      <NIcon><Icons.material.FileDownloadOutlined /></NIcon>
    </template>
  </NButton>
  <ContentDownloadDialog
    v-if="downloadProvider"
    v-model:show="showDownloadDialog"
    :destinations
    :disabled="resolvingDownload"
    :page
    @submit="downloadContent"
  />
</template>