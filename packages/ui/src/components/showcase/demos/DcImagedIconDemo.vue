<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { NTag } from 'naive-ui'
import { h } from 'vue'

import { DcImagedIcon } from '@/index'

import DemoSection from '../DemoSection.vue'

const imageUrl = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="36" fill="#2080f0"/>
    <path d="M42 42h76v76H42z" fill="white" fill-opacity=".2"/>
    <path d="m48 108 24-28 18 17 13-14 19 25H48Z" fill="white"/>
    <circle cx="99" cy="61" r="11" fill="#63e2b7"/>
  </svg>
`)}`

const imageIcon = uni.image.Image.create({
  $$plugin: 'showcase',
  forkNamespace: 'showcase-icon',
  path: imageUrl,
})

const SparkIcon = () =>
  h('svg', { 'viewBox': '0 0 24 24', 'fill': 'currentColor', 'aria-hidden': 'true' }, [
    h('path', { d: 'm12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z' }),
  ])

const BookIcon = () =>
  h('svg', { 'viewBox': '0 0 24 24', 'fill': 'currentColor', 'aria-hidden': 'true' }, [
    h('path', {
      d: 'M5 3h11a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1Zm2 14a1 1 0 0 0 0 2h10v-2H7Z',
    }),
  ])
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="imaged-icon-types"
      title="图标类型"
      description="同一个组件统一处理 Vue 图标组件与图片资源两条渲染路径。"
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <article
          class="flex items-center gap-4 rounded-xl border border-[var(--nui-divider-color)] p-4"
        >
          <DcImagedIcon :icon="SparkIcon" :size-spacing="12" />
          <div>
            <div class="font-medium text-[var(--nui-text-color-1)]">组件图标</div>
            <NTag class="mt-2" size="small" type="success" :bordered="false">Component</NTag>
          </div>
        </article>
        <article
          class="flex items-center gap-4 rounded-xl border border-[var(--nui-divider-color)] p-4"
        >
          <DcImagedIcon :icon="BookIcon" :size-spacing="12" bg-color="#dbeafe" />
          <div>
            <div class="font-medium text-[var(--nui-text-color-1)]">自定义背景</div>
            <NTag class="mt-2" size="small" type="info" :bordered="false">bgColor</NTag>
          </div>
        </article>
        <article
          class="flex items-center gap-4 rounded-xl border border-[var(--nui-divider-color)] p-4"
        >
          <DcImagedIcon :icon="imageIcon" :size-spacing="12" />
          <div>
            <div class="font-medium text-[var(--nui-text-color-1)]">图片资源</div>
            <NTag class="mt-2" size="small" :bordered="false">Image</NTag>
          </div>
        </article>
      </div>
    </DemoSection>

    <DemoSection
      section-id="imaged-icon-spacing"
      title="背景与留白"
      description="不同 spacing 尺寸可用于工具栏、列表头像和强调入口。"
    >
      <div class="flex flex-wrap items-end gap-6 rounded-xl bg-[var(--nui-action-color)] p-5">
        <div v-for="size in [8, 10, 14, 18]" :key="size" class="text-center">
          <DcImagedIcon
            :icon="size === 14 ? imageIcon : SparkIcon"
            :size-spacing="size"
            :bg-color="size === 18 ? '#dcfce7' : '#f3f4f6'"
            class="ring-2 ring-white/70"
          />
          <div class="mt-2 font-mono text-xs text-[var(--nui-text-color-3)]">{{ size }}</div>
        </div>
      </div>
    </DemoSection>
  </div>
</template>