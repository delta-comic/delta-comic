<script setup lang="ts">
import { SubscribeDB } from '@delta-comic/db'
import { usePluginStore } from '@delta-comic/plugin'
import { useInfiniteQuery } from '@pinia/colada'
import { computed } from 'vue'

import Card from './subCard.vue'

const $props = defineProps<{
  source: SubscribeDB.Item
}>()
const $emit = defineEmits<{
  unsubscribe: []
}>()

const pluginStore = usePluginStore()
const subscribe = computed(() => {
  const [plugin] = SubscribeDB.key.toJSON($props.source.key)
  if ($props.source.type == 'author') {
    const type = $props.source.author.subscribe!
    const sub = pluginStore.plugins.get(plugin)?.subscribe?.[type]
    if (!sub) throw new Error(`Can not found subscribe item which type: ${type}, plugin: ${plugin}`)
    return sub
  }
  throw new Error('not impl')
})
const source = useInfiniteQuery({
  query: async ({ pageParam, signal }) =>
    subscribe.value.fetchAuthorContent($props.source.author!, pageParam, signal),
  key: () => [
    {
      item: () => $props.source.key
    }
  ],
  initialPageParam: subscribe.value.fetchAuthorContent.initialPageParam,
  getNextPageParam: lastPage => lastPage.nextPage ?? null
})
</script>

<template>
  <DcWaterfall
    :source="{ type: 'infinite', value: source }"
    :padding="0"
    :col="1"
    :gap="4"
    v-slot="{ item }"
  >
    <Card :item @unsubscribe="$emit('unsubscribe')" />
  </DcWaterfall>
</template>