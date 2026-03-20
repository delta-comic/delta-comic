<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { isString } from 'es-toolkit'
import { computed } from 'vue'

import DcImagedIcon from './DcImagedIcon.vue'

const $props = defineProps<{
  author: { $$plugin: string; icon: string | uni.resource.RawResource | uni.image.RawImage }
  sizeSpacing: number
}>()
const icon = computed(() =>
  isString($props.author.icon)
    ? uni.item.Item.authorIcon.get([$props.author.$$plugin, $props.author.icon])!
    : uni.image.Image.create($props.author.icon)
)
</script>

<template>
  <DcImagedIcon :icon :sizeSpacing />
</template>