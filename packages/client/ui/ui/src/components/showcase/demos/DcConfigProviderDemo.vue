<script setup lang="ts">
import { defineComponent, h } from 'vue'

import { DcConfigProvider, useDcConfig } from '@/index'

import DemoSection from '../DemoSection.vue'

const ConfigPreview = defineComponent({
  name: 'ConfigPreview',
  setup() {
    const config = useDcConfig()
    return () =>
      h(
        'div',
        {
          class:
            'rounded-xl border border-(--nui-divider-color) bg-(--nui-card-color) p-5 text-(--nui-text-color-1)',
        },
        [
          h('div', { class: 'mb-3 size-10 rounded-full bg-(--demo-accent)' }),
          h('dl', { class: 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm' }, [
            h('dt', { class: 'text-(--nui-text-color-3)' }, 'locale'),
            h('dd', config.locale.value ?? '—'),
            h('dt', { class: 'text-(--nui-text-color-3)' }, 'theme'),
            h('dd', config.theme.value ?? '—'),
            h('dt', { class: 'text-(--nui-text-color-3)' }, '--demo-accent'),
            h('dd', String(config.style.value['--demo-accent'] ?? '—')),
          ]),
        ],
      )
  },
})
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="config-provider-root"
      title="根配置"
      description="Provider 将语言、主题和 CSS 变量同时应用到组件树并通过 useDcConfig 暴露。"
    >
      <DcConfigProvider locale="zh-CN" theme="light" :style="{ '--demo-accent': '#18a058' }">
        <ConfigPreview />
      </DcConfigProvider>
    </DemoSection>

    <DemoSection
      section-id="config-provider-nested"
      title="嵌套与覆盖"
      description="内层 Provider 继承未声明的配置，只覆盖自己的语言和样式变量。"
    >
      <DcConfigProvider locale="en-US" theme="dark" :style="{ '--demo-accent': '#2080f0' }">
        <DcConfigProvider locale="zh-TW" :style="{ '--demo-accent': '#d03050' }">
          <ConfigPreview />
        </DcConfigProvider>
      </DcConfigProvider>
      <template #note
        >示例中的 theme 只表示下发配置；应用的实际主题仍由根 NConfigProvider 控制。</template
      >
    </DemoSection>
  </div>
</template>