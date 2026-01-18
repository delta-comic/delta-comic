<script setup lang='ts'>
import { isEmpty } from 'es-toolkit/compat'
import { inject, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { isShowMainHomeNavBar } from '@/symbol'
import { until, useResizeObserver } from '@vueuse/core'
import { Comp, coreModule, requireDepend, Store, uni, Utils } from 'delta-comic-core'
import { LikeOutlined } from '@vicons/antd'
import { DrawOutlined } from '@vicons/material'
const waterfall = useTemplateRef('waterfall')
const $router = useRouter()
const temp = Store.useTemp().$applyRaw('randomConfig', () => ({
  stream: Utils.data.Stream.create<uni.item.Item>(async function* (signal, that) {
    that.pages.value = Infinity
    that.page.value = 0
    while (true) {
      that.page.value++
      const result = await Utils.eventBus.SharedFunction.callRandom('getRandomProvide', signal).result
      yield result
    }
  }),
  scroll: 0
}))

const containBound = ref<DOMRectReadOnly>()
useResizeObserver(() => <HTMLDivElement | null>waterfall.value?.scrollParent?.firstElementChild, ([b]) => containBound.value = b.contentRect)
onMounted(async () => {
  if (!isEmpty(temp.stream._data)) {
    await until(() => (containBound.value?.height ?? 0) > 8).toBeTruthy()
    waterfall.value?.scrollParent?.scroll(0, temp.scroll)
  }
})
const stop = $router.beforeEach(() => {
  stop()
  temp.scroll = waterfall.value?.scrollTop ?? 0
})

const showNavBar = inject(isShowMainHomeNavBar)!
watch(() => waterfall.value?.scrollTop, async (scrollTop, old) => {
  if (!scrollTop || !old) return
  if (scrollTop - old > 0) showNavBar.value = false
  else showNavBar.value = true
}, { immediate: true })

const { comp } = requireDepend(coreModule)
</script>

<template>
  <Comp.Waterfall class="w-full" :source="temp.stream" v-slot="{ item, index }" ref="waterfall">
    <component :is="uni.item.Item.itemCard.get(item.contentType) ?? comp.ItemCard" :item type="small" free-height
      :key="`${index}|${item.id}`">
      <NIcon color="var(--van-text-color-2)" size="14px">
        <DrawOutlined />
      </NIcon>
      <span class="ml-0.5 text-xs van-ellipsis max-w-2/3 text-(--van-text-color-2)">{{ item.author.join(',') }}</span>
      <template #smallTopInfo>
        <span v-if="item.viewNumber">
          <VanIcon name="eye-o" class="mr-0.5" size="14px" />
          <span>{{ item.viewNumber }}</span>
        </span>
        <span v-if="item.likeNumber">
          <NIcon class="mr-0.5" size="14px" color="white">
            <LikeOutlined />
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
  </Comp.Waterfall>
</template>