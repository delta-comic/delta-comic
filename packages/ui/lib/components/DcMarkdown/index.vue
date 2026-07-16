<script setup lang="ts">
import { isTauri } from '@tauri-apps/api/core'
import { useCssVar, useEventListener } from '@vueuse/core'
import MarkdownIt, { type Options } from 'markdown-it'
import { computed } from 'vue'

import { cn, type StyleProps } from '../../utils'

import { createTemplate } from './helper'

const $props = withDefaults(
  defineProps<
    {
      markdown: string
      plugins?: Parameters<MarkdownIt['use']>[]
      config?: Options
      env?: object
      isDarkMode?: boolean
    } & StyleProps
  >(),
  { plugins: [] as any, config: {} as any },
)

const md = computed(() => {
  let md = new MarkdownIt({ ...$props.config, linkify: true })
  md = $props.plugins.reduce((md, plugin) => md.use(...plugin), md)

  return md
})

const messageKey = `markdown-router-${Math.random()}`

const pColor = useCssVar('--p-color')
const htmlTemplateUrl = computed(() =>
  createTemplate({
    color: pColor.value ?? '',
    isDark: $props.isDarkMode,
    content: md.value.render($props.markdown, $props.env),
    messageKey,
    delegateLinkOpen: isTauri(),
  }),
)

const openInBrowser = (href: string) => {
  window.open(href, '_blank', 'noopener,noreferrer')
}

const openExternalLink = (href: string) => {
  if (!isTauri()) {
    openInBrowser(href)
    return
  }

  void import('@tauri-apps/plugin-shell')
    .then(({ open }) => open(href))
    .catch(() => openInBrowser(href))
}

useEventListener('message', ev => {
  const data: unknown = ev.data
  if (
    typeof data !== 'object' ||
    data === null ||
    !('type' in data) ||
    data.type !== messageKey ||
    !('href' in data) ||
    typeof data.href !== 'string'
  ) {
    return
  }
  openExternalLink(data.href)
})
</script>

<template>
  <iframe :srcdoc="htmlTemplateUrl" :class="cn('border-0 border-none', $props.class)" :style />
</template>