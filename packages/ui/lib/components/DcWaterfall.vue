<script
  setup
  lang="ts"
  generic="T = any, PF extends (d: T[]) => any[] = ((d: T[]) => T[]) | ((d: T[]) => T[])"
>
import { useTemp } from '@delta-comic/core'
import { callbackToPromise, type RPromiseContent, Stream } from '@delta-comic/model'
import { VirtualWaterfall } from '@lhlyu/vue-virtual-waterfall'
import { useEventListener } from '@vant/use'
import { type IfAny, useResizeObserver, useScroll } from '@vueuse/core'
import { isArray } from 'es-toolkit/compat'
import { twMerge } from 'tailwind-merge'
import { type Ref, computed, nextTick, onUnmounted, shallowReactive, shallowRef, watch } from 'vue'
import { useTemplateRef } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'

import type { StyleProps } from '@/utils'

import DcContent from './DcContent.vue'

const $props = withDefaults(
  defineProps<
    {
      source: { data: RPromiseContent<any, T[]>; isEnd?: boolean } | Stream<T>
      col?: [min: number, max: number] | number
      padding?: number
      gap?: number
      minHeight?: number
      dataProcessor?: PF
      unReloadable?: boolean
    } & StyleProps
  >(),
  { padding: 4, col: 2, gap: 4, minHeight: 0 }
)
const $emit = defineEmits<{
  next: [then: () => void]
  reset: []
  retry: [then: () => void]
  col: [2, 2]
}>()
const dataProcessor = (v: T[]) => $props.dataProcessor?.(v) ?? v


const column = computed(
  () => (isArray($props.col) ? $props.col : [$props.col, $props.col]) as [min: number, max: number]
)


const unionSource = computed(() => ({
  ...(Stream.isStream($props.source)
    ? {
        data: dataProcessor($props.source.data.value),
        isDone: $props.source.isDone.value,
        isRequesting: $props.source.isRequesting.value,
        isError: !!$props.source.error.value,
        length: dataProcessor($props.source.data.value).length,
        isEmpty: $props.source.isEmpty.value,
        source: $props.source
      }
    : {
        data: dataProcessor($props.source.data.data.value ?? []),
        isDone: $props.source.isEnd,
        isRequesting: $props.source.data.isLoading.value,
        isError: $props.source.data.isError.value,
        length: dataProcessor($props.source.data.data.value ?? []).length,
        isEmpty: $props.source.data.isEmpty.value,
        source: $props.source.data
      }),
  next: () =>
    Stream.isStream($props.source)
      ? $props.source.next()
      : callbackToPromise(r => $emit('next', r)),
  retry: () =>
    Stream.isStream($props.source)
      ? $props.source.retry()
      : callbackToPromise(r => $emit('retry', r)),
  reset: () => (Stream.isStream($props.source) ? $props.source.reset() : $emit('reset'))
}))


const isPullRefreshHold = shallowRef(false)
const isRefreshing = shallowRef(false)
const handleRefresh = async () => {
  unionSource.value.reset()
  console.log('reset done')
  await unionSource.value.next()
  isRefreshing.value = false
}


const content = useTemplateRef<ComponentExposed<typeof DcContent>>('content')
const scrollParent = computed(() => content.value?.cont)
const { y: contentScrollTop } = useScroll(scrollParent)
const handleScroll = () => {
  const { isDone, isError, isRequesting, retry, next } = unionSource.value
  if (isRequesting || isDone) return
  const el = scrollParent.value
  if (!el) return
  const scrollHeight = el.scrollHeight
  const scrollTop = el.scrollTop
  const clientHeight = el.clientHeight


  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  if (distanceFromBottom <= 100) {
    if (isError) retry()
    else next()
  }
}
useEventListener('scroll', handleScroll, { target: <Ref<HTMLDivElement>>scrollParent })
watch(
  () => $props.source,
  () => {
    const { isError, retry, next, isEmpty } = unionSource.value
    if (!isEmpty) return
    if (isError) retry()
    else next()
  },
  { deep: 1, immediate: true }
)


const waterfallEl = useTemplateRef('waterfallEl')


const waterfallIndex = useTemp().$apply('waterfall', () => ({ top: 0 }))
const thisIndex = waterfallIndex.top++
const sizeMapTemp = useTemp().$applyRaw(`waterfall:${thisIndex}`, () =>
  shallowReactive(new Map<T, number>())
)


const sizeWatcherCleaner = new Array<VoidFunction>()
const observer = new MutationObserver(([mutation]) => {
  for (const stop of sizeWatcherCleaner) stop()
  if (!(mutation.target instanceof HTMLDivElement) || !unionSource.value.data) return
  const elements = [...mutation.target.children] as HTMLDivElement[]
  for (const element of elements) {
    const index = Number(element.dataset.index)
    const data = unionSource.value.data[index]
    const handler = () => {
      const bound = element.firstElementChild?.getBoundingClientRect()
      sizeMapTemp.set(data, bound?.height ?? $props.minHeight)
    }
    const size = useResizeObserver(<HTMLElement>element.firstElementChild, handler)
    handler()

    sizeWatcherCleaner.push(() => size.stop())
  }
})
watch(waterfallEl, waterfallEl => {
  if (!waterfallEl) return observer.disconnect()
  observer.observe(waterfallEl.$el, { childList: true })
})
onUnmounted(() => {
  observer.disconnect()
  for (const stop of sizeWatcherCleaner) stop()
})


const reloadController = shallowRef(true)
defineExpose({
  scrollTop: contentScrollTop,
  scrollParent: scrollParent,
  async reloadList() {
    reloadController.value = false
    sizeMapTemp.clear()
    await nextTick()
    reloadController.value = true
  }
})


defineSlots<{
  default(props: {
    item: IfAny<ReturnType<PF>[number], T, ReturnType<PF>[number]>
    index: number
    height?: number
    minHeight: number
    length: number
  }): any
}>()
</script>

<template>
  <VanPullRefresh
    v-model="isRefreshing"
    :class="twMerge('relative h-full', $props.class)"
    v-if="reloadController"
    :disabled="
      unReloadable || unionSource.isRequesting || (!!contentScrollTop && !isPullRefreshHold)
    "
    @refresh="handleRefresh"
    @change="({ distance }) => (isPullRefreshHold = !!distance)"
    :style
  >
    <DcContent
      retriable
      :source="Stream.isStream(source) ? source : source.data"
      classLoading="mt-2 !h-[24px]"
      classEmpty="h-full!"
      classError="h-full!"
      class="h-full w-full overflow-auto"
      @retry="unionSource.retry()"
      @resetRetry="handleRefresh"
      :hideLoading="isPullRefreshHold && unionSource.isRequesting"
      ref="content"
    >
      <VirtualWaterfall
        :items="unionSource.data"
        :gap
        :padding
        :preloadScreenCount="[0, 1]"
        ref="waterfallEl"
        v-slot="{ item, index }: { item: T; index: number }"
        :calcItemHeight="item => sizeMapTemp.get(item) ?? minHeight"
        class="waterfall"
        :minColumnCount="column[0]"
        :maxColumnCount="column[1]"
      >
        <slot
          :item
          :index
          :height="sizeMapTemp.get(item)"
          :length="unionSource.length"
          :minHeight
        />
      </VirtualWaterfall>
    </DcContent>
  </VanPullRefresh>
</template>