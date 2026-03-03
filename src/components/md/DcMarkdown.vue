<script setup lang="ts">
import { useConfig } from '@delta-comic/plugin'
import MarkdownIt, { type Options } from 'markdown-it'
import { computed } from 'vue'

import darkStyle from './dark.css?url'
import lightStyle from './light.css?url'
const lightUrl = new URL(lightStyle, import.meta.url)
const darkUrl = new URL(darkStyle, import.meta.url)

const $props = withDefaults(
  defineProps<{
    markdown: string
    plugins?: Parameters<MarkdownIt['use']>[]
    config?: Options
    env?: object
  }>(),
  {
    plugins: [] as any,
    config: {} as any
  }
)

const md = computed(() => {
  let md = new MarkdownIt($props.config)
  md = $props.plugins.reduce((md, plugin) => md.use(...plugin), md)
  return md
})

const config = useConfig()

const htmlTemplate = computed(
  () => `
<!doctype html>
<html lang="zh-cn" class="static size-full">
  <head>
    <meta charset="UTF-8" />
    <title>Markdown</title>
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src * chrome-extension: blob: tauri: local: ipc: ws: wss: 'unsafe-inline' 'unsafe-eval' data: chrome-extension: blob: tauri:; script-src * chrome-extension: blob: tauri: local: ipc: ws: wss: 'unsafe-inline' 'unsafe-eval'; connect-src * chrome-extension: blob: tauri: local: ipc: ws: wss: 'unsafe-inline'; img-src * chrome-extension: blob: tauri: local: ipc: ws: wss: data: chrome-extension: blob: tauri:; frame-src * chrome-extension: blob: tauri: local: ipc: ws: wss:; style-src * chrome-extension: blob: tauri: local: ipc: ws: wss: 'unsafe-inline';"
    />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"
    />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />

    <link rel="stylesheet" href="${config.isDark ? darkUrl : lightUrl}" />
  </head>
  <body>
    <div id="write">
      ${md.value.render($props.markdown, $props.env)}
    </div>
  </body>
</html>
`
)
</script>

<template>
  <iframe :srcdoc="htmlTemplate" />
</template>