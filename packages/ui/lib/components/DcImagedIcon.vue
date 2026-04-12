<script setup lang="ts">
import { uni } from '@delta-comic/model'
import type { Component } from 'vue'

import { cn, type StyleProps } from '../utils'

import DcImage from './DcImage.vue'
import DcVar from './DcVar.vue'

const $props = defineProps<
  {
    icon: Component | uni.image.Image | uni.resource.Resource
    bgColor?: string
    sizeSpacing: number
  } & StyleProps
>()
</script>

<template>
  <DcVar
    :value="[
      `--box-size:${sizeSpacing};background-color:${bgColor ?? ' var(--color-gray-200)'};`,
      $props.style
    ]"
    v-slot="{ value: style }"
  >
    <DcImage
      :class="cn('aspect-square size-[--spacing(var(--box-size))] shrink-0', $props.class)"
      v-if="uni.image.Image.is(icon) || uni.resource.Resource.is(icon)"
      :src="uni.resource.Resource.is(icon) ? uni.image.Image.create(icon) : icon"
      round
      fit="cover"
      :style
    />
    <div
      :class="
        cn(
          'flex aspect-square size-[--spacing(var(--box-size))] items-center justify-center rounded-full bg-gray-200',
          $props.class
        )
      "
      :style
      v-else
    >
      <NIcon color="var(--p-color)" :size="`calc(var(--spacing) * ${0.65 * sizeSpacing})`">
        <component :is="icon" />
      </NIcon>
    </div>
  </DcVar>
</template>