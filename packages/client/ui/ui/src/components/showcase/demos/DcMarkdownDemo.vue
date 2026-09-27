<script setup lang="ts">
import { NSwitch } from 'naive-ui'
import { shallowRef } from 'vue'

import { DcMarkdown } from '@/index'

import DemoSection from '../DemoSection.vue'

const dark = shallowRef(false)
const basicMarkdown = `# Delta Comic

用 **Markdown** 组织插件说明、更新日志和阅读提示。

- 支持列表
- 支持 [外部链接](https://github.com/delta-comic/delta-comic)

> 内容在隔离的 iframe 中渲染。`
const advancedMarkdown = `## 配置示例

| 属性 | 说明 |
| --- | --- |
| linkify | 自动识别链接 |
| breaks | 将换行转换为断行 |

https://delta-comic.github.io

\`\`\`ts
const reader = { theme: 'dark', page: 12 }
\`\`\``
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="markdown-syntax"
      title="标题、列表、引用与链接"
      description="markdown 传入原始内容，组件在 iframe 内完成排版并代理外部链接。"
    >
      <DcMarkdown :markdown="basicMarkdown" class="h-96 w-full rounded-lg bg-white" />
    </DemoSection>

    <DemoSection
      section-id="markdown-config"
      title="MarkdownIt 配置与主题"
      description="config、env 和 isDarkMode 可控制解析行为、渲染环境与 iframe 主题。"
    >
      <template #actions>
        <div class="flex items-center gap-2 text-xs text-[var(--nui-text-color-3)]">
          深色主题 <NSwitch v-model:value="dark" size="small" />
        </div>
      </template>
      <DcMarkdown
        :markdown="advancedMarkdown"
        :config="{ breaks: true, typographer: true }"
        :env="{ source: 'showcase' }"
        :is-dark-mode="dark"
        class="h-96 w-full rounded-lg"
        :class="dark ? 'bg-neutral-950' : 'bg-white'"
      />
    </DemoSection>
  </div>
</template>