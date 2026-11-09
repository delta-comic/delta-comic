<script setup lang="ts">
import { UniImage, UniResource } from '@delta-comic/model'
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'

import { cn, type StyleProps } from '../utils'

import DcImage from './DcImage.vue'
import DcVar from './DcVar.vue'

const $props = defineProps<
  { icon: Component | UniImage | UniResource; bgColor?: string; sizeSpacing: number } & StyleProps
>()
</script>

<template>
  <DcVar
    :value="[
      `--box-size:${sizeSpacing};background-color:${bgColor ?? ' var(--color-gray-200)'};`,
      $props.style,
    ]"
    v-slot="{ value: style }"
  >
    <DcImage
      :class="cn('aspect-square size-[--spacing(var(--box-size))] shrink-0', $props.class)"
      v-if="UniImage.is(icon) || UniResource.is(icon)"
      :src="UniResource.is(icon) ? UniImage.create(icon) : icon"
      round
      fit="cover"
      :style
    />
    <div
      :class="
        cn(
          'flex aspect-square size-[--spacing(var(--box-size))] items-center justify-center rounded-full bg-gray-200',
          $props.class,
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