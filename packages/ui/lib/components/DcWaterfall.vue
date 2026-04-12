<script setup lang="ts" generic="T extends object, PF extends ListFn<T>">
import { useTemp } from '@delta-comic/core'
import type { StreamQuery } from '@delta-comic/model'
import { VirtualWaterfall } from '@lhlyu/vue-virtual-waterfall'
import type { UseInfiniteQueryReturn, UseQueryReturn } from '@pinia/colada'
import { useEventListener } from '@vant/use'
import { type IfAny, useResizeObserver, useScroll } from '@vueuse/core'
import { isArray } from 'es-toolkit/compat'
import { type Ref, computed, nextTick, onUnmounted, shallowReactive, shallowRef, watch } from 'vue'
import { useTemplateRef } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'

import { cn } from '@/utils'

import type { ListFn, StyleProps } from '../utils'

import DcContent from './DcContent.vue'

const $props = withDefaults(
  defineProps<
    {
      source:
        | {
            type: 'query'
            value: UseQueryReturn<T[]>
            next?: () => any
          }
        | {
            type: 'infinite'
            value: UseInfiniteQueryReturn<T[]>
          }
        | {
            type: 'stream'
            value: UseInfiniteQueryReturn<Awaited<ReturnType<StreamQuery<T>['query']>>>
          }
        | {
            type: 'array'
            value: Array<T>
            refetch?: () => any
            refresh?: () => any
            next?: () => any
          }
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

const column = computed(
  () => (isArray($props.col) ? $props.col : [$props.col, $props.col]) as [min: number, max: number]
)

const dataProcessor = (v: T[]) => $props.dataProcessor?.(v) ?? v
const source = computed(() =>
  (() => {
    switch ($props.source.type) {
      case 'query':
        return {
          data: dataProcessor($props.source.value.data.value ?? []),
          isDone: true,
          isLoading: $props.source.value.isLoading.value,
          error: $props.source.value.error.value,
          refetch() {
            if ($props.source.type != 'query') return
            return $props.source.value.refetch(false)
          },
          refresh() {
            if ($props.source.type != 'query') return
            return $props.source.value.refresh(false)
          },
          next: $props.source.next
        }
      case 'stream':
        return {
          data: dataProcessor(
            $props.source.value.data.value?.pages.reduce(
              (acc, v) => acc.concat(v.data),
              new Array<T>()
            ) ?? []
          ),
          isDone: $props.source.value.hasNextPage.value,
          isLoading: $props.source.value.isLoading.value,
          error: $props.source.value.error.value,
          refetch() {
            if ($props.source.type != 'infinite') return
            return $props.source.value.refetch(false)
          },
          refresh() {
            if ($props.source.type != 'infinite') return
            return $props.source.value.refresh(false)
          },
          next() {
            if ($props.source.type != 'infinite') return
            return $props.source.value.loadNextPage({ cancelRefetch: true })
          }
        }
      case 'infinite':
        return {
          data: dataProcessor($props.source.value.data.value?.pages.flat(1) ?? []),
          isDone: $props.source.value.hasNextPage.value,
          isLoading: $props.source.value.isLoading.value,
          error: $props.source.value.error.value,
          refetch() {
            if ($props.source.type != 'stream') return
            return $props.source.value.refetch(false)
          },
          refresh() {
            if ($props.source.type != 'stream') return
            return $props.source.value.refresh(false)
          },
          next() {
            if ($props.source.type != 'stream') return
            return $props.source.value.loadNextPage({ cancelRefetch: true })
          }
        }
      case 'array':
      default:
        return {
          data: dataProcessor($props.source.value),
          isDone: true,
          isLoading: false,
          error: undefined,
          refetch: $props.source.refetch,
          refresh: $props.source.refresh,
          next: $props.source.next
        }
    }
  })()
)

const isPullRefreshHold = shallowRef(false)
const isRefreshing = shallowRef(false)
const handleRefresh = async () => {
  await source.value.refetch?.()
  isRefreshing.value = false
}

const content = useTemplateRef<ComponentExposed<typeof DcContent>>('content')
const scrollParent = computed(() => content.value?.cont)
const { y: contentScrollTop } = useScroll(scrollParent)

useEventListener(
  'scroll',
  () => {
    const { isDone, error, isLoading, refetch, next } = source.value
    if (isLoading || isDone) return
    const el = scrollParent.value
    if (!el) return
    const scrollHeight = el.scrollHeight
    const scrollTop = el.scrollTop
    const clientHeight = el.clientHeight

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    if (distanceFromBottom <= 100) {
      if (error) refetch?.()
      else next?.()
    }
  },
  { target: <Ref<HTMLDivElement>>scrollParent }
)
// i remove a watch

const waterfallEl = useTemplateRef('waterfallEl')

const waterfallIndex = useTemp().$apply('waterfall', () => ({ top: 0 }))
const thisIndex = waterfallIndex.top++
const sizeMapTemp = useTemp().$applyRaw(`waterfall:${thisIndex}`, () =>
  shallowReactive(new Map<T, number>())
)

const sizeWatcherCleaner = new Array<VoidFunction>()
const observer = new MutationObserver(([mutation]) => {
  for (const stop of sizeWatcherCleaner) stop()
  if (!(mutation.target instanceof HTMLDivElement) || !source.value.data) return
  const elements = [...mutation.target.children] as HTMLDivElement[]
  for (const element of elements) {
    const index = Number(element.dataset.index)
    const data = source.value.data[index]
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
    :class="cn('relative h-full', $props.class)"
    v-if="reloadController"
    :disabled="
      unReloadable ||
      !source.refetch ||
      !!source.error ||
      source.isLoading ||
      (!!contentScrollTop && !isPullRefreshHold)
    "
    @refresh="handleRefresh"
    @change="({ distance }) => (isPullRefreshHold = !!distance)"
    :style
  >
    <DcContent
      :source="{
        type: 'raw',
        data: source.data,
        error: source.error,
        isLoading: source.isLoading,
        refetch: source.refetch
      }"
      classLoading="mt-2 !h-[24px]"
      classEmpty="h-full!"
      classError="h-full!"
      class="h-full w-full overflow-auto"
      :hideLoading="isPullRefreshHold && source.isLoading"
      ref="content"
    >
      <VirtualWaterfall
        :items="source.data"
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
          :length="source.data.length"
          :minHeight
        />
      </VirtualWaterfall>
    </DcContent>
  </VanPullRefresh>
</template>