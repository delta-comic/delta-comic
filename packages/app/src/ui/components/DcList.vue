<script setup lang="ts" generic="T extends object">
import { useTemplateRef } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'

import { type RawSource, type StyleProps } from '../utils'

import DcWaterfall from './DcWaterfall.vue'

const $props = defineProps<
  { source: RawSource<T>; minHeight: number; unReloadable?: boolean } & StyleProps
>()

const waterfall = useTemplateRef<ComponentExposed<typeof DcWaterfall>>('waterfall')

defineExpose({
  /** 当前滚动位置 */
  get scrollTop() {
    return waterfall.value?.scrollTop
  },
  /** 滚动容器元素引用 */
  get scrollParent() {
    return waterfall.value?.scrollParent
  },
  /** 重置瀑布流列表 */
  reloadList() {
    return waterfall.value?.reloadList()
  },
})

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
  <DcWaterfall
    :source="$props.source"
    :class
    :style
    :minHeight
    :unReloadable
    :col="1"
    :gap="0"
    :padding="0"
    ref="waterfall"
    v-slot="{ index, item, length, minHeight, height }"
  >
    <slot :index :item :length :minHeight :height></slot>
  </DcWaterfall>
</template>