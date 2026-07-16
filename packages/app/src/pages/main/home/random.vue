<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { usePluginStore } from '@delta-comic/plugin'
import { useTemp } from '@delta-comic/utils'
import { useInfiniteQuery } from '@pinia/colada'
import { until, useResizeObserver } from '@vueuse/core'
import { isEmpty } from 'es-toolkit/compat'
import { computed, inject, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { Icons } from '@/icons'
import { isShowMainHomeNavBar } from '@/symbol'
const waterfall = useTemplateRef('waterfall')
const $router = useRouter()
const temp = useTemp().$applyRaw('randomConfig', () => ({ scroll: 0 }))
const plugin = usePluginStore()

const randomProvider = computed(() =>
  plugin.plugins
    .values()
    .toArray()
    .map(v => v.search?.fetchRandomItems)
    .filter(v => !!v),
)
const getRandomItems = async (signal: AbortSignal) => {
  const providers = randomProvider.value
  if (providers.length === 0) return []
  const index = Math.floor(Math.random() * providers.length)
  return await providers[index]!(signal)
}

let index = 0
const source = useInfiniteQuery({
  key: () => ['random'],
  initialPageParam: 1,
  getNextPageParam: () => (index += 1),
  query: async ({ signal }) => {
    return await getRandomItems(signal)
  },
})

const containBound = shallowRef<DOMRectReadOnly>()
useResizeObserver(
  () => <HTMLDivElement | null>waterfall.value?.scrollParent?.firstElementChild,
  ([b]) => (containBound.value = b.contentRect),
)
onMounted(async () => {
  if (!isEmpty(source.data.value)) {
    await until(() => (containBound.value?.height ?? 0) > 8).toBeTruthy()
    waterfall.value?.scrollParent?.scroll(0, temp.scroll)
  }
})
const stop = $router.beforeEach(() => {
  stop()
  temp.scroll = waterfall.value?.scrollTop ?? 0
})

const showNavBar = inject(isShowMainHomeNavBar)!
watch(
  () => waterfall.value?.scrollTop,
  async (scrollTop, old) => {
    if (!scrollTop || !old) return
    if (scrollTop - old > 0) showNavBar.value = false
    else showNavBar.value = true
  },
  { immediate: true },
)
</script>

<template>
  <DcWaterfall
    class="size-full!"
    :source="{ type: 'infinite', value: source }"
    v-slot="{ item, index }"
    ref="waterfall"
  >
    <component
      :is="uni.item.Item.itemCards.get(item.contentType)"
      :item
      type="small"
      free-height
      :key="`${index}|${item.id}`"
    >
      <NIcon color="var(--dc-text-secondary)" size="14px">
        <Icons.material.DrawOutlined />
      </NIcon>
      <span class="ml-0.5 max-w-2/3 dc-ellipsis text-xs text-(--dc-text-secondary)">{{
        item.author.join(',')
      }}</span>
      <template #smallTopInfo>
        <span v-if="item.viewNumber">
          <NIcon class="mr-0.5" size="14">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5c5.5 0 9.5 4.7 10.6 6.1a1.5 1.5 0 0 1 0 1.8C21.5 14.3 17.5 19 12 19S2.5 14.3 1.4 12.9a1.5 1.5 0 0 1 0-1.8C2.5 9.7 6.5 5 12 5Zm0 2c-3.8 0-7 3-8.5 5c1.5 2 4.7 5 8.5 5s7-3 8.5-5C19 10 15.8 7 12 7Zm0 2.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5Z"
              />
            </svg>
          </NIcon>
          <span>{{ item.viewNumber }}</span>
        </span>
        <span v-if="item.likeNumber">
          <NIcon class="mr-0.5" size="14px" color="white">
            <Icons.antd.LikeOutlined />
          </NIcon>
          <span>{{ item.likeNumber }}</span>
        </span>
        <template v-else>
          <span v-for="category of item.categories.slice(0, 2)" :key="category.name">
            <NIcon class="mr-0.5" size="14" color="white">
              <Icons.material.AutoAwesomeMosaicOutlined />
            </NIcon>
            <span>{{ category.name }}</span>
          </span>
        </template>
        <span class="absolute right-1">{{ item.length }}</span>
      </template>
    </component>
  </DcWaterfall>
</template>