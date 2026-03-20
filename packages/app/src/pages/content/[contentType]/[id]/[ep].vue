<script setup lang="ts">
import { useFullscreen } from '@delta-comic/core'
import { HistoryDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { createLoadingMessage, usePreventBack } from '@delta-comic/ui'
import { computed, watch, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useContentStore } from '@/stores/content'

const $route = useRoute<'/content/[contentType]/[id]/[ep]'>()
const contentStore = useContentStore()


definePage({ meta: { statusBar: 'dark', force: true } })


const ep = $route.params.ep.toString()
const id = $route.params.id.toString()
const contentType = $route.params.contentType.toString()


const page = computed(
  () => contentStore.history.get(contentStore.$createHistoryKey(contentType, id, ep))!
)


contentStore.$load(contentType, id, ep)


const layout = computed(() => uni.content.ContentPage.viewLayout.get(page.value.contentType))


const { isFullscreen } = useFullscreen()
usePreventBack(isFullscreen, ref(true))


// history
const union = computed(() => page.value.union.value)
if (!union.value) var loading = createLoadingMessage()
watch(
  union,
  union => {
    if (!union) return
    loading?.success()
    HistoryDB.upsert(union)
  },
  { immediate: true }
)
</script>

<template>
  <template v-if="union">
    <component :page :is="layout" v-if="layout">
      <template #view>
        <component :page :is="page.ViewComp" :isFullScreen="isFullscreen" />
      </template>
    </component>
  </template>
</template>