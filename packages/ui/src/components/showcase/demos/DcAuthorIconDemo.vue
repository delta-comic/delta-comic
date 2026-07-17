<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { NTag } from 'naive-ui'
import { h } from 'vue'

import { DcAuthorIcon } from '@/index'

import DemoSection from '../DemoSection.vue'

const avatarUrl = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18a058"/><stop offset="1" stop-color="#36ad6a"/></linearGradient></defs>
    <rect width="160" height="160" rx="80" fill="url(#g)"/>
    <circle cx="80" cy="60" r="28" fill="white" fill-opacity=".92"/>
    <path d="M30 142c8-33 25-50 50-50s42 17 50 50" fill="white" fill-opacity=".92"/>
  </svg>
`)}`

const RegisteredPenIcon = () =>
  h('svg', { 'viewBox': '0 0 24 24', 'fill': 'none', 'aria-hidden': 'true' }, [
    h('path', { d: 'M4 20l4.2-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z', fill: 'currentColor' }),
    h('path', { 'd': 'm13.8 7.4 2.8 2.8', 'stroke': 'white', 'stroke-width': '1.5' }),
  ])

uni.item.Item.authorIcon.set(['showcase', 'pen'], RegisteredPenIcon)

const resourceAuthor = {
  $$plugin: 'showcase',
  icon: { $$plugin: 'showcase', forkNamespace: 'showcase-avatar', path: avatarUrl },
}
const registeredAuthor = { $$plugin: 'showcase', icon: 'pen' }
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="author-icon-resource"
      title="资源图标"
      description="作者图标既可以来自图片资源，也可以通过插件名称查找已注册的 Vue 图标。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <article
          class="flex items-center gap-4 rounded-xl border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] p-4"
        >
          <DcAuthorIcon :author="resourceAuthor" :size-spacing="14" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-[var(--nui-text-color-1)]">图片资源作者</div>
            <div class="mt-1 text-xs text-[var(--nui-text-color-3)]">
              RawImage → Image → DcImage
            </div>
          </div>
          <NTag size="small" :bordered="false">资源</NTag>
        </article>

        <article
          class="flex items-center gap-4 rounded-xl border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] p-4"
        >
          <DcAuthorIcon :author="registeredAuthor" :size-spacing="14" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-[var(--nui-text-color-1)]">插件注册作者</div>
            <div class="mt-1 text-xs text-[var(--nui-text-color-3)]">showcase:pen</div>
          </div>
          <NTag size="small" type="success" :bordered="false">组件</NTag>
        </article>
      </div>
    </DemoSection>

    <DemoSection
      section-id="author-icon-sizes"
      title="尺寸与留白"
      description="sizeSpacing 使用 Tailwind spacing 标尺，适配列表、卡片和个人资料等密度。"
    >
      <div class="flex flex-wrap items-end gap-6 rounded-xl bg-[var(--nui-action-color)] p-5">
        <div v-for="size in [8, 10, 12, 16]" :key="size" class="text-center">
          <DcAuthorIcon
            :author="size % 4 === 0 ? resourceAuthor : registeredAuthor"
            :size-spacing="size"
          />
          <div class="mt-2 font-mono text-xs text-[var(--nui-text-color-3)]">{{ size }}</div>
        </div>
      </div>
      <template #note>字符串图标需要先以“插件 ID + 图标名”注册，图片资源则直接解析。</template>
    </DemoSection>
  </div>
</template>