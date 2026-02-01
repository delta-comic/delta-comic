<script setup lang="ts">
import { Comp, uni } from 'delta-comic-core'
import type { Component } from 'vue'

defineProps<{ icon: Component | uni.image.Image; bgColor?: string; sizeSpacing: number }>()
</script>

<template>
  <Comp.Image
    class="aspect-square size-[calc(var(--spacing)*var(--box-size))] shrink-0"
    v-if="uni.image.Image.is(icon)"
    :src="icon"
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