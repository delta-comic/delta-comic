<script setup lang="ts">
import { SharedFunction, useTemp } from '@delta-comic/core'
import { uni } from '@delta-comic/model'
import { useInfiniteQuery } from '@pinia/colada'
import { until, useResizeObserver } from '@vueuse/core'
import { isEmpty } from 'es-toolkit/compat'
import { inject, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { Icons } from '@/icons'
import { isShowMainHomeNavBar } from '@/symbol'
const waterfall = useTemplateRef('waterfall')
const $router = useRouter()
const temp = useTemp().$applyRaw('randomConfig', () => ({
  scroll: 0
}))

let index = 0
const source = useInfiniteQuery({
  key: () => ['random'],
  initialPageParam: 1,
  getNextPageParam: () => (index += 1),
  query: async ({ signal }) => {
    const result = await SharedFunction.callRandom('getRandomProvide', signal).result
    return result
  }
})

const containBound = ref<DOMRectReadOnly>()
useResizeObserver(
  () => <HTMLDivElement | null>waterfall.value?.scrollParent?.firstElementChild,
  ([b]) => (containBound.value = b.contentRect)
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
  { immediate: true }
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
      <NIcon color="var(--van-text-color-2)" size="14px">
        <Icons.material.DrawOutlined />
      </NIcon>
      <span class="van-ellipsis ml-0.5 max-w-2/3 text-xs text-(--van-text-color-2)">{{
        item.author.join(',')
      }}</span>
      <template #smallTopInfo>
        <span v-if="item.viewNumber">
          <VanIcon name="eye-o" class="mr-0.5" size="14px" />
          <span>{{ item.viewNumber }}</span>
        </span>
        <span v-if="item.likeNumber">
          <NIcon class="mr-0.5" size="14px" color="white">
            <Icons.antd.LikeOutlined />
          </NIcon>
          <span>{{ item.likeNumber }}</span>
        </span>
        <template v-else>
          <span v-for="category of item.categories.slice(0, 2)">
            <VanIcon class="mr-0.5" name="apps-o" size="14px" color="white" />
            <span>{{ category }}</span>
          </span>
        </template>
        <span class="absolute right-1">{{ item.length }}</span>
      </template>
    </component>
  </DcWaterfall>
</template>