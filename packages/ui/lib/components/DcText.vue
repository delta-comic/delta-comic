<script setup lang="ts">
import DOMPurify from 'dompurify'
import { escape } from 'es-toolkit'
import Link from 'linkify-it'
import { twMerge } from 'tailwind-merge'
import tlds from 'tlds'
import { computed } from 'vue'

import type { StyleProps } from '@/utils'

const $props = withDefaults(defineProps<{ text?: string } & StyleProps>(), {
  text: ''
})

const linker = new Link().tlds(tlds).tlds('onion', true).set({ fuzzyIP: true })

const texts = computed(() => {
  const raw = escape($props.text)
  var linked = raw
  while (true) {
    const matched = linker.matchAtStart(linked)
    if (!matched) break

    const pre = linked.slice(0, matched.index)
    const link = `<a href="${matched.url}" />`
    const post = linked.slice(matched.lastIndex)

    return pre + link + post
  }
  return DOMPurify.sanitize(raw)
})
</script>

<template>
  <div
    :class="twMerge('break-normal whitespace-pre-wrap text-(--van-text-color)', $props.class)"
    :style
    v-html="texts"
  ></div>
</template>