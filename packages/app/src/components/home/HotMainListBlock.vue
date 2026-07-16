<script setup lang="ts">
import { uni } from '@delta-comic/model'
import type { Search } from '@delta-comic/plugin'
import { useQuery } from '@pinia/colada'
import { chunk } from 'es-toolkit'

const props = defineProps<{ block: Search.HotMainList; blockIndex: number; plugin: string }>()

const source = useQuery({
  key: () => ['hot-main-list', props.plugin, props.block.name, props.blockIndex],
  query: async ({ signal }) => await props.block.content(signal),
})

const getItemCard = (contentType: uni.content.ContentType_) =>
  uni.item.Item.itemCards.get(contentType)

const splitItems = (value: unknown) => {
  const items = Array.isArray(value) ? (value as uni.item.Item[]) : []
  return chunk(items, Math.max(1, Math.ceil(items.length / 2)))
}
</script>

<template>
  <div class="sticky top-0 z-10 bg-(--dc-background) py-px">
    <div
      class="relative mx-auto my-1 flex h-10 w-[calc(100%-8px)] dc-interactive items-center rounded bg-(--dc-surface)"
      @click="block.onClick?.()"
    >
      <span class="ml-3 text-xl font-bold text-(--nui-primary-color)">{{ block.name }}</span>
      <NIcon class="absolute! right-3" color="var(--dc-text-tertiary)" size="20px">
        <slot name="arrow" />
      </NIcon>
    </div>
  </div>
  <DcContent :source="{ type: 'query', query: source }" v-slot="{ data }">
    <div class="flex gap-1 px-1">
      <div
        class="flex w-full flex-col gap-1"
        v-for="items of splitItems(data)"
        :key="items[0]?.id ?? 'empty'"
      >
        <component
          v-for="item of items"
          :key="item.id"
          :item
          free-height
          type="small"
          :is="getItemCard(item.contentType)"
        />
      </div>
    </div>
  </DcContent>
</template>