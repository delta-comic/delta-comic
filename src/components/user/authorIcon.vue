<script setup lang="ts">
import { uni } from 'delta-comic-core'
import { isString } from 'es-toolkit'
import { computed } from 'vue'

const $props = defineProps<{
  author: { $$plugin: string; icon: string | uni.resource.RawResource }
  sizeSpacing: number
}>()
const icon = computed(() =>
  isString($props.author.icon)
    ? uni.item.Item.authorIcon.get([$props.author.$$plugin, $props.author.icon])!
    : uni.image.Image.create($props.author.icon)
)
</script>

<template>
  <ImagedIcon :icon :sizeSpacing />
</template>