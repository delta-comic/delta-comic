<script setup lang="ts">
import { DcText } from '@/index'

import DemoSection from '../DemoSection.vue'

const multilineText = `第一行保留原始换行。
第二行包含较长的说明文字，组件会根据容器宽度自然换行。

空行也会被完整保留。`

const unsafeText = [
  `<img src="x" onerror="alert('xss')">`,
  `<scr${'ipt'}>alert('unsafe')</scr${'ipt'}>`,
].join('\n')
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="text-content"
      title="文本内容"
      description="纯文本会保留换行和空白，并可通过 class 调整排版与强调方式。"
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <article class="rounded-xl border border-[var(--nui-divider-color)] p-4">
          <div class="mb-3 text-xs font-semibold text-[var(--nui-text-color-3)]">多行文本</div>
          <DcText :text="multilineText" class="text-sm leading-7" />
        </article>
        <article class="rounded-xl bg-[var(--nui-action-color)] p-4">
          <div class="mb-3 text-xs font-semibold text-[var(--nui-text-color-3)]">自定义排版</div>
          <DcText
            text="Delta Comic UI\n安全文本 · 自动换行 · 样式透传"
            class="font-mono text-base leading-8 text-[var(--nui-primary-color)]!"
          />
        </article>
      </div>
    </DemoSection>

    <DemoSection
      section-id="text-security"
      title="链接与转义"
      description="URL 会转换为安全链接，输入中的 HTML 标签仅作为文本显示。"
    >
      <div class="space-y-4">
        <article class="rounded-xl border border-[var(--nui-divider-color)] p-4">
          <div class="mb-2 text-xs font-semibold text-[var(--nui-text-color-3)]">链接识别</div>
          <DcText
            text="https://example.com/delta-comic"
            class="pointer-events-none text-sm text-[var(--nui-primary-color)]! underline"
          />
        </article>
        <article class="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
          <div class="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300">HTML 转义</div>
          <DcText :text="unsafeText" class="font-mono text-sm leading-6" />
        </article>
      </div>
      <template #note>示例链接已禁用指针事件，避免从组件展示页发生真实导航。</template>
    </DemoSection>
  </div>
</template>