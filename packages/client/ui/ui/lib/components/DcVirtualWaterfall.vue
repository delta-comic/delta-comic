<script setup lang="ts" generic="T extends object">
import { useEventListener } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'

interface ItemSpace<T> {
  index: number
  item: T
  column: number
  top: number
  left: number
  bottom: number
  height: number
}

const $props = withDefaults(
  defineProps<{
    items?: T[]
    scrollParent?: HTMLElement
    virtual?: boolean
    rowKey?: string
    gap?: number
    padding?: number
    preloadScreenCount?: [before: number, after: number]
    itemMinWidth?: number
    minColumnCount?: number
    maxColumnCount?: number
    calcItemHeight?: (item: T, itemWidth: number) => number
  }>(),
  {
    items: () => [],
    virtual: true,
    rowKey: 'id',
    gap: 15,
    padding: 15,
    preloadScreenCount: () => [0, 0],
    itemMinWidth: 220,
    minColumnCount: 2,
    maxColumnCount: 10,
    calcItemHeight: () => 250,
  },
)

defineSlots<{ default(props: { item: T; index: number }): any }>()

const root = useTemplateRef<HTMLElement>('root')
const containerWidth = shallowRef(0)
const scrollTop = shallowRef(0)
const viewportHeight = shallowRef(0)

function syncViewport() {
  const scrollParent = $props.scrollParent
  scrollTop.value = scrollParent?.scrollTop ?? 0
  viewportHeight.value = scrollParent?.clientHeight ?? 0
}

function syncWidth() {
  containerWidth.value = root.value?.clientWidth || $props.scrollParent?.clientWidth || 0
}

useEventListener(() => $props.scrollParent, 'scroll', syncViewport, { passive: true })

watch(
  [root, () => $props.scrollParent],
  ([element, scrollParent], _, onCleanup) => {
    syncViewport()
    syncWidth()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      syncViewport()
      syncWidth()
    })
    if (element) observer.observe(element)
    if (scrollParent && scrollParent !== element) observer.observe(scrollParent)
    onCleanup(() => observer.disconnect())
  },
  { flush: 'post', immediate: true },
)

const columnCount = computed(() => {
  const min = Math.max(1, Math.floor($props.minColumnCount))
  const max = Math.max(min, Math.floor($props.maxColumnCount))
  const availableWidth = Math.max(containerWidth.value - $props.padding * 2, 0)
  const naturalCount = Math.max(
    1,
    Math.floor((availableWidth + $props.gap) / ($props.itemMinWidth + $props.gap)),
  )
  return Math.min(max, Math.max(min, naturalCount))
})

const columnWidth = computed(() => {
  const availableWidth = Math.max(containerWidth.value - $props.padding * 2, 0)
  return Math.max(
    0,
    (availableWidth - Math.max(0, columnCount.value - 1) * $props.gap) / columnCount.value,
  )
})

const itemSpaces = computed<ItemSpace<T>[]>(() => {
  if (containerWidth.value <= 0) return []

  const columnHeights = Array.from({ length: columnCount.value }, () => $props.padding)
  return $props.items.map((item, index) => {
    let column = 0
    for (let candidate = 1; candidate < columnHeights.length; candidate++) {
      if (columnHeights[candidate] < columnHeights[column]) column = candidate
    }

    const height = Math.max(0, $props.calcItemHeight(item, columnWidth.value))
    const top = columnHeights[column]
    const bottom = top + height
    columnHeights[column] = bottom + $props.gap

    return {
      index,
      item,
      column,
      top,
      left: $props.padding + column * (columnWidth.value + $props.gap),
      bottom,
      height,
    }
  })
})

const contentHeight = computed(() => {
  if (!itemSpaces.value.length) return $props.padding * 2
  return Math.max(...itemSpaces.value.map(item => item.bottom)) + $props.padding
})

const visibleItemSpaces = computed(() => {
  if (!$props.virtual) return itemSpaces.value
  if (viewportHeight.value <= 0) return []

  const [before, after] = $props.preloadScreenCount
  const viewportStart = Math.max(0, scrollTop.value - Math.max(0, before) * viewportHeight.value)
  const viewportEnd = scrollTop.value + (Math.max(0, after) + 1) * viewportHeight.value
  return itemSpaces.value.filter(item => item.bottom > viewportStart && item.top < viewportEnd)
})

function getItemKey(space: ItemSpace<T>) {
  const key = (space.item as Record<string, unknown>)[$props.rowKey]
  return typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol'
    ? key
    : space.index
}

defineExpose({
  get element() {
    return root.value
  },
})
</script>

<template>
  <div
    ref="root"
    class="relative w-full"
    :style="{ height: `${contentHeight}px`, willChange: 'height' }"
  >
    <div
      v-for="space in visibleItemSpaces"
      :key="getItemKey(space)"
      :data-index="space.index"
      class="absolute top-0 left-0"
      :style="{
        width: `${columnWidth}px`,
        height: `${space.height}px`,
        transform: `translate3d(${space.left}px, ${space.top}px, 0)`,
        containIntrinsicSize: `${columnWidth}px ${space.height}px`,
      }"
    >
      <slot :item="space.item" :index="space.index" />
    </div>
  </div>
</template>