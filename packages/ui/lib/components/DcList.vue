<script setup lang="ts" generic="T extends object, PF extends ListFn<T>">
import type { UseInfiniteQueryReturn, UseQueryReturn } from '@pinia/colada'
import { type IfAny, useScroll } from '@vueuse/core'
import { ceil, debounce } from 'es-toolkit/compat'
import { NVirtualList, type VirtualListInst, type VirtualListProps } from 'naive-ui'
import { twMerge } from 'tailwind-merge'
import { type Ref, shallowRef, useTemplateRef, watch } from 'vue'
import { computed } from 'vue'

import type { ListFn, StyleProps } from '../utils'

import DcContent from './DcContent.vue'
import DcVar from './DcVar.vue'

const $props = defineProps<
  {
    source:
      | { type: 'query'; value: UseQueryReturn<T[]>; next?: () => any }
      | { type: 'infinite'; value: UseInfiniteQueryReturn<T[]> }
      | {
          type: 'array'
          value: Array<T>
          refetch?: () => any
          refresh?: () => any
          next?: () => any
        }
    itemHeight: number
    listProp?: Partial<VirtualListProps>
    itemResizable?: boolean
    dataProcessor?: PF
    unReloadable?: boolean
  } & StyleProps
>()


const dataProcessor = (v: T[]) => $props.dataProcessor?.(v) ?? v
const source = computed(() =>
  $props.source.type == 'query'
    ? {
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
    : $props.source.type == 'infinite'
      ? {
          data: dataProcessor($props.source.value.data.value?.pages.flat(1) ?? []),
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
      : {
          data: dataProcessor($props.source.value),
          isDone: true,
          isLoading: false,
          error: undefined,
          refetch: $props.source.refetch,
          refresh: $props.source.refresh,
          next: $props.source.next
        }
)


watch(
  source,
  source => {
    if (!source.isLoading)
      if (ceil(window.innerHeight / $props.itemHeight) + 2 > source.data.length && !source.isDone) {
        if (source.error) source.refresh?.()
        else source.next?.()
      }
  },
  { immediate: true }
)


const vList = useTemplateRef('vList')
const { y: listScrollTop } = useScroll(() => vList.value?.getScrollContainer())
const handleScroll: VirtualListProps['onScroll'] = debounce(async () => {
  const list = vList.value?.virtualListInstRef?.itemsElRef?.querySelector(' .v-vl-visible-items')
  if (!list) return
  // 能用
  const { itemHeight } = $props
  const { data, isDone, error, isLoading, refresh, next } = source.value
  if (!data) return
  if (
    !isLoading &&
    !isDone &&
    itemHeight * (length - 2) <
      listScrollTop.value + (list?.children?.length ?? window.innerHeight / itemHeight) * itemHeight
  ) {
    if (error) refresh?.()
    else next?.()
  }
}, 200)
const isPullRefreshHold = shallowRef(false)
const isRefreshing = shallowRef(false)
const handleRefresh = async () => {
  await source.value.refetch?.()
  isRefreshing.value = false
}


type TrueItem = IfAny<ReturnType<PF>[number], T, ReturnType<PF>[number]>


defineSlots<{
  default(props: { height: number; data: { item: TrueItem; index: number } }): any
}>()
defineExpose({ scrollTop: listScrollTop, listInstance: <Ref<VirtualListInst>>(<unknown>vList) })
</script>

<template>
  <VanPullRefresh
    v-model="isRefreshing"
    :class="twMerge('relative', $props.class)"
    @refresh="handleRefresh"
    :disabled="
      unReloadable ||
      !source.refetch ||
      !!source.error ||
      source.isLoading ||
      (!!listScrollTop && !isPullRefreshHold)
    "
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
      classEmpty="!h-full"
      classError="!h-full"
      :hideLoading="isPullRefreshHold && source.isLoading"
    >
      <DcVar :value="source.data" v-slot="{ value }">
        <NVirtualList
          :="listProp ?? {}"
          :itemResizable
          :itemSize="itemHeight"
          @scroll="handleScroll"
          :items="value"
          v-slot="{ item }: { item: TrueItem }"
          ref="vList"
          :class="
            twMerge(
              'h-full overflow-x-hidden',
              isPullRefreshHold ? 'overflow-y-hidden' : 'overflow-y-auto'
            )
          "
        >
          <slot :height="itemHeight" :data="{ item, index: value.indexOf(item) }" />
        </NVirtualList>
      </DcVar>
    </DcContent>
  </VanPullRefresh>
</template>