<script
  setup
  lang="ts"
  generic="T extends NonNullable<VirtualListProps['items']>[number], PF extends ListFn<T>"
>
import { callbackToPromise, type RPromiseContent, Stream } from '@delta-comic/model'
import { type IfAny, useScroll } from '@vueuse/core'
import { ceil, debounce, isArray, isEmpty } from 'es-toolkit/compat'
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
      | { data: RPromiseContent<any, T[]>; isEnd?: boolean; reloadable?: boolean }
      | Stream<T>
      | Array<T>
    itemHeight: number
    listProp?: Partial<VirtualListProps>
    goBottom?: boolean
    itemResizable?: boolean
    dataProcessor?: PF
    unReloadable?: boolean
  } & StyleProps
>()
const $emit = defineEmits<{ next: [then: () => void]; reset: []; retry: [then: () => void] }>()


const dataProcessor = (v: T[]) => $props.dataProcessor?.(v) ?? v
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
    : isArray($props.source)
      ? {
          data: dataProcessor($props.source),
          isDone: true,
          isRequesting: false,
          isError: false,
          length: dataProcessor($props.source).length,
          isEmpty: isEmpty($props.source),
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
watch(
  () => unionSource.value.data,
  () => {
    if ($props.goBottom) vList.value?.scrollTo({ position: 'bottom', behavior: 'instant' })
  },
  { flush: 'post', deep: true, immediate: true }
)
watch(
  unionSource,
  unionSource => {
    if (!unionSource.isRequesting)
      if (
        ceil(window.innerHeight / $props.itemHeight) + 2 > unionSource.length &&
        !unionSource.isDone
      ) {
        if (unionSource.isError) unionSource.retry()
        else unionSource.next()
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
  const { data, isDone, isError, isRequesting, retry, next, length } = unionSource.value
  if (!data) return
  if (
    !isRequesting &&
    !isDone &&
    itemHeight * (length - 2) <
      listScrollTop.value + (list?.children?.length ?? window.innerHeight / itemHeight) * itemHeight
  ) {
    if (isError) retry()
    else next()
  }
}, 200)
const isPullRefreshHold = shallowRef(false)
const isRefreshing = shallowRef(false)
const handleRefresh = async () => {
  unionSource.value.reset()
  console.log('reset done')
  await unionSource.value.next()
  isRefreshing.value = false
}


defineSlots<{
  default(props: {
    height: number
    data: { item: IfAny<ReturnType<PF>[number], T, ReturnType<PF>[number]>; index: number }
  }): any
}>()
defineExpose({ scrollTop: listScrollTop, listInstance: <Ref<VirtualListInst>>(<unknown>vList) })


type TrueItem = IfAny<ReturnType<PF>[number], T, ReturnType<PF>[number]>
</script>

<template>
  <VanPullRefresh
    v-model="isRefreshing"
    :class="twMerge('relative', $props.class)"
    @refresh="handleRefresh"
    :disabled="
      unReloadable ||
      (Stream.isStream(source) ? false : isArray(source) ? true : (source.reloadable ?? true)) ||
      unionSource.isError ||
      unionSource.isRequesting ||
      (!!listScrollTop && !isPullRefreshHold)
    "
    @change="({ distance }) => (isPullRefreshHold = !!distance)"
    :style
  >
    <DcContent
      retriable
      :source="Stream.isStream(source) ? source : isArray(source) ? source : source.data"
      classLoading="mt-2 !h-[24px]"
      classEmpty="!h-full"
      classError="!h-full"
      @resetRetry="handleRefresh"
      :hideLoading="isPullRefreshHold && unionSource.isRequesting"
      @retry="unionSource.retry()"
    >
      <DcVar :value="unionSource.data" v-slot="{ value }">
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