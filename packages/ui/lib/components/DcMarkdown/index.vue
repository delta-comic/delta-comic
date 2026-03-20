<script setup lang="ts">
import { open } from '@tauri-apps/plugin-shell'
import { useEventListener } from '@vant/use'
import { useCssVar } from '@vueuse/core'
import MarkdownIt, { type Options } from 'markdown-it'
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'

import type { StyleProps } from '@/utils'

import darkStyle from './dark.css?inline'
import lightStyle from './light.css?inline'

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
  {
    plugins: [] as any,
    config: {} as any
  }
)


const md = computed(() => {
  let md = new MarkdownIt({
    ...$props.config,
    linkify: true
  })
  md = $props.plugins.reduce((md, plugin) => md.use(...plugin), md)

  return md
})


const eventMessage = `markdown-router-${Math.random()}`


const pColor = useCssVar('--p-color')


const htmlTemplateUrl = computed(
  () => `
<!doctype html>
<html lang="zh-cn" class="static size-full">
  <head>
    <meta charset="UTF-8" />
    <title>Markdown</title>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"
    />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
  </head>
  <body>
    <style>
      :root {
        --p-color: ${pColor.value};
      }
      ${$props.isDarkMode ? darkStyle : lightStyle}
    </style>
    <div id="write">
      ${md.value.render($props.markdown, $props.env)}
    </div>
    <script>
      document.addEventListener('click', function(e){
        const el = e.target.closest('a');
        if(!el) return;
        const href = el.dataset.href || el.getAttribute('href');
        if(!href) return;
        e.preventDefault();
        // 发送请求给父窗口，请求导航
        console.debug('${eventMessage}', href)
        window.parent.postMessage({ type:'${eventMessage}', href });
      });
    <\/script>
  </body>
</html>
`
)


useEventListener('message', ev => {
  const event = ev as MessageEvent
  console.debug(eventMessage)
  const data = event.data as { href: string; type?: string }
  if (data.type != eventMessage) return
  open(data.href)
})
</script>

<template>
  <iframe :srcdoc="htmlTemplateUrl" :class="twMerge('border-0 border-none', $props.class)" :style />
</template>