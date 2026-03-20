<script setup lang="ts">
import { uni } from '@delta-comic/model'
import type { Component } from 'vue'

import DcImage from './DcImage.vue'

defineProps<{
  icon: Component | uni.image.Image | uni.resource.Resource
  bgColor?: string
  sizeSpacing: number
}>()
</script>

<template>
  <DcImage
    class="aspect-square size-[calc(var(--spacing)*var(--box-size))] shrink-0"
    v-if="uni.image.Image.is(icon) || uni.resource.Resource.is(icon)"
    :src="uni.resource.Resource.is(icon) ? uni.image.Image.create(icon) : icon"
    round
    fit="cover"
    :style="`--box-size:${sizeSpacing};background-color:${bgColor ?? ' var(--color-gray-200)'};`"
  />
  <div
    class="flex aspect-square size-[calc(var(--spacing)*var(--box-size))] items-center justify-center rounded-full bg-gray-200"
    :style="`--box-size:${sizeSpacing};background-color:${bgColor ?? ' var(--color-gray-200)'};`"
    v-else
  >
    <NIcon color="var(--p-color)" :size="`calc(var(--spacing) * ${(sizeSpacing / 10) * 6.5})`">
      <component :is="icon" />
    </NIcon>
  </div>
</template>