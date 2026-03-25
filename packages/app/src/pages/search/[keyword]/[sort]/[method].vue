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
  initialPageParam: method.value.fetchSearchResult.initialPageParam,
  query: async ({ signal, pageParam }) => {
    return await method.value.fetchSearchResult(
      $route.params.keyword,
      $route.params.sort,
      pageParam,
      signal
    )
  },
  getNextPageParam: lp => lp.nextPage
})
</script>

<template></template>