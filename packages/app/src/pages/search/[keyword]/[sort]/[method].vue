<!-- <script lang="ts">
import { usePluginStore } from '@delta-comic/plugin'
import { defineColadaLoader } from 'vue-router/experimental/pinia-colada'

import { searchSourceKey } from '@/components/search/source'
import { useInfiniteQuery } from '@pinia/colada'
export const useSearch = defineColadaLoader('/search/[keyword]/[sort]/[method]', {
  key: to => [
    'search',
    { keyword: to.params.keyword, sort: to.params.sort, method: to.params.method }
  ],
  query: ({ params: { keyword, method: source, sort } }, { signal }) => {
    const pluginStore = usePluginStore()
    const [plugin, name] = searchSourceKey.toJSON(source)
    const method = Object.fromEntries(Object.fromEntries(pluginStore.allSearchSource)[plugin])[name]

    method.search(keyword, sort, page)
  }
})
</script> -->

<script setup lang="ts">
import { usePluginStore } from '@delta-comic/plugin'
import { useInfiniteQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { searchSourceKey } from '@/components/search/source'

const $route = useRoute<'/search/[keyword]/[sort]/[method]'>()


const pluginStore = usePluginStore()
const method = computed(() => {
  const [plugin, name] = searchSourceKey.toJSON($route.params.method)
  return Object.fromEntries(Object.fromEntries(pluginStore.allSearchSource)[plugin])[name]
})


const { state } = useInfiniteQuery({
  key: () => [
    'search',
    { keyword: $route.params.keyword, sort: $route.params.sort, method: $route.params.method }
  ],
  initialPageParam: 1,
  query: async ({ signal, pageParam }) => {
    return await method.value.search($route.params.keyword, $route.params.sort, pageParam, signal)
  },
  getNextPageParam: (_, __, lastPageParam) => lastPageParam + 1
})
</script>

<template></template>