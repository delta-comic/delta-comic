<script setup lang="ts">
import { escape } from 'es-toolkit'
import Link from 'linkify-it'
import tlds from 'tlds'
import { computed } from 'vue'

import { cn, type StyleProps } from '../utils'

const $props = withDefaults(defineProps<{ text?: string } & StyleProps>(), { text: '' })

const linker = new Link().tlds(tlds).tlds('onion', true).set({ fuzzyIP: true })

const texts = computed(() => {
  const matches = linker.match($props.text)
  if (!matches) return escape($props.text)

  let cursor = 0
  const linked: string[] = []
  for (const matched of matches) {
    linked.push(escape($props.text.slice(cursor, matched.index)))
    const href = /^(?:https?|mailto|ftp):/i.test(matched.url) ? matched.url : '#'
    linked.push(
      `<a href="${escape(href)}" rel="noopener noreferrer" target="_blank">${escape(matched.raw)}</a>`,
    )
    cursor = matched.lastIndex
  }
  linked.push(escape($props.text.slice(cursor)))
  return linked.join('')
})
</script>

<template>
  <div
    :class="cn('break-normal whitespace-pre-wrap text-(--dc-color-text)', $props.class)"
    :style
    v-html="texts"
  ></div>
</template>