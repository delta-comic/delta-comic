<script setup lang="ts">
import { useFullscreen } from '@delta-comic/core'
import { HistoryDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { usePreventBack } from '@delta-comic/ui'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useContentStore } from '@/stores/content'

definePage({ meta: { statusBar: 'dark', force: true } })
const $route = useRoute<'/content/[contentType]/[id]/[ep]'>()
const ep = $route.params.ep.toString()
const id = $route.params.id.toString()
const contentType = $route.params.contentType

const contentStore = useContentStore()
contentStore.$load(contentType, id, ep)

const page = computed(
  () => contentStore.history.get(contentStore.$createHistoryKey(contentType, id, ep))!
)

const layout = computed(() => uni.content.ContentPage.layouts.get($route.params.contentType))

const { isFullscreen } = useFullscreen()
usePreventBack(isFullscreen, ref(true))

// history
const { upsert } = HistoryDB.useUpsert()
page.value.fetchDetail().then(item =>
  upsert({
    item: item.toJSON()
  })
)
</script>

<template>
  <component :page :is="layout" v-if="layout">
    <template #view="{ item }">
      <component :page :is="page.ViewComponent" :union="item" />
    </template>
  </component>
</template>