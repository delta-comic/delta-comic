<script setup lang="ts">
import { UniImage, type UniImageRaw, UniItem, type UniResourceRaw } from '@delta-comic/model'
import { isString } from 'es-toolkit'
import { computed } from 'vue'

import DcImagedIcon from './DcImagedIcon.vue'

const $props = defineProps<{
  author: { $$plugin: string; icon: string | UniResourceRaw | UniImageRaw }
  sizeSpacing: number
}>()
const icon = computed(() =>
  isString($props.author.icon)
    ? UniItem.authorIcon.get([$props.author.$$plugin, $props.author.icon])!
    : UniImage.create($props.author.icon),
)
</script>

<template>
  <DcImagedIcon :icon :sizeSpacing />
</template>