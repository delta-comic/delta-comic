<script setup lang="ts" generic="T extends object">
import { VirtualWaterfall } from '@lhlyu/vue-virtual-waterfall'
import { useEventListener, useScroll } from '@vueuse/core'
import { isArray } from 'es-toolkit/compat'
import { computed, markRaw, nextTick, onUnmounted, shallowReactive, shallowRef, watch } from 'vue'
import { useTemplateRef } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'

import { cn, toUnionSource } from '@/utils'

import type { RawSource, StyleProps } from '../utils'

import DcContent from './DcContent.vue'
import DcPullRefresh from './DcPullRefresh.vue'

const $props = withDefaults(
  defineProps<
    {
      source: RawSource<T>
      col?: [min: number, max: number] | number
      padding?: number
      gap?: number
      minHeight?: number
      unReloadable?: boolean
    } & StyleProps
  >(),
  { padding: 4, col: 2, gap: 4, minHeight: 0 },
)

const column = computed(
  () => (isArray($props.col) ? $props.col : [$props.col, $props.col]) as [min: number, max: number],
)

const source = computed(() => toUnionSource($props.source))

// ── 尺寸映射 (组件内 shallowReactive，Map key 不会被递归响应式) ──
const sizeMap = shallowReactive(new Map<T, number>())

// 对数据项 markRaw，防止被其他响应式系统意外包裹
watch(
  () => source.value.data,
  data => {
    if (!data) return
    for (const item of data) markRaw(item)
    // 清理 sizeMap 中已不在 data 里的 key
    const dataSet = new Set(data)
    for (const key of sizeMap.keys()) {
      if (!dataSet.has(key)) sizeMap.delete(key)
    }
  },
  { immediate: true },
)

// ── 滚动容器引用 ──
const content = useTemplateRef<ComponentExposed<typeof DcContent>>('content')
const scrollParent = shallowRef<HTMLElement | undefined>()
watch(
  () => content.value?.cont,
  el => {
    scrollParent.value = el ?? undefined
  },
  { immediate: true },
)
const { y: contentScrollTop } = useScroll(scrollParent)

// ── 滚动加载 (节流 200ms) ──
let scrollTimer: ReturnType<typeof setTimeout> | null = null
const handleScroll = () => {
  const { isDone, error, isLoading, refetch, next } = source.value
  if (isLoading || isDone) return
  const el = scrollParent.value
  if (!el) return
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distanceFromBottom <= 100) {
    if (error) refetch?.()
    else next?.()
  }
}
const throttledScroll = () => {
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    handleScroll()
  }, 200)
}
useEventListener(scrollParent, 'scroll', throttledScroll)

// ── 下拉刷新状态 ──
const isPullRefreshHold = shallowRef(false)
const isRefreshing = shallowRef(false)

// ── 单一 ResizeObserver ──
const resizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    const el = entry.target as HTMLElement
    const parent = el.parentElement
    if (!parent) continue
    const index = Number(parent.dataset.index)
    if (Number.isNaN(index)) continue
    const data = source.value.data?.[index]
    if (!data) continue
    const height = el.getBoundingClientRect().height
    if (height > 0) sizeMap.set(data, height)
  }
})

// ── 增量 MutationObserver ──
const observedElements = new WeakSet<Element>()
const waterfallEl = useTemplateRef('waterfallEl')

const observeNewChildren = (target: HTMLElement) => {
  const children = [...target.children] as HTMLElement[]
  for (const child of children) {
    const firstChild = child.firstElementChild
    if (!firstChild || observedElements.has(firstChild)) continue
    observedElements.add(firstChild)
    resizeObserver.observe(firstChild)
    // 初始测量
    const bound = firstChild.getBoundingClientRect()
    const index = Number(child.dataset.index)
    const data = source.value.data?.[index]
    if (data && bound.height > 0) sizeMap.set(data, bound.height)
  }
}

const mutationObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.target instanceof HTMLDivElement) {
      observeNewChildren(mutation.target)
    }
  }
})

watch(waterfallEl, el => {
  if (!el) {
    mutationObserver.disconnect()
    return
  }
  mutationObserver.observe(el.$el as HTMLElement, { childList: true })
  observeNewChildren(el.$el as HTMLElement)
})

onUnmounted(() => {
  resizeObserver.disconnect()
  mutationObserver.disconnect()
  if (scrollTimer) clearTimeout(scrollTimer)
})

// ── reloadList (用 key 强制重渲染) ──
const waterfallKey = shallowRef(0)
async function reloadList() {
  sizeMap.clear()
  waterfallKey.value++
  await nextTick()
}

defineExpose({ scrollTop: contentScrollTop, scrollParent, reloadList })

defineSlots<{
  default(props: {
    item: T
    index: number
    height?: number
    minHeight: number
    length: number
  }): any
}>()
</script>

<template>
  <DcPullRefresh
    :refresher="() => source.refetch()"
    v-model:refreshing="isRefreshing"
    v-model:pulling="isPullRefreshHold"
    :class="cn('relative h-full', $props.class)"
    :style
    contentClass="h-full"
    :disabled="unReloadable"
  >
    <DcContent
      :source="{
        type: 'raw',
        data: source.data,
        error: source.error,
        isLoading: source.isLoading,
        refetch: source.refetch,
      }"
      classLoading="mt-2 !h-[24px]"
      classEmpty="h-full!"
      classError="h-full!"
      class="h-full w-full overflow-auto"
      :hideLoading="isPullRefreshHold && source.isLoading"
      ref="content"
    >
      <VirtualWaterfall
        :key="waterfallKey"
        :items="source.data"
        :gap
        :padding
        :preloadScreenCount="[0, 1]"
        ref="waterfallEl"
        v-slot="{ item, index }: { item: T; index: number }"
        :calcItemHeight="item => sizeMap.get(item) ?? minHeight"
        class="waterfall"
        :minColumnCount="column[0]"
        :maxColumnCount="column[1]"
      >
        <slot :item :index :height="sizeMap.get(item)" :length="source.data.length" :minHeight />
      </VirtualWaterfall>
    </DcContent>
  </DcPullRefresh>
</template>