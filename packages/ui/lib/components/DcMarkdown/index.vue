<script setup lang="ts">
import { open } from '@tauri-apps/plugin-shell'
import { useEventListener } from '@vant/use'
import { useCssVar } from '@vueuse/core'
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
  }),
)

useEventListener('message', ev => {
  const event = ev as MessageEvent
  const data = event.data as { href: string; type?: string }
  if (data.type != messageKey) return
  open(data.href)
})
</script>

<template>
  <iframe :srcdoc="htmlTemplateUrl" :class="cn('border-0 border-none', $props.class)" :style />
</template>