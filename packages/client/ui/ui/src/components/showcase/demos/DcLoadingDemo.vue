<script setup lang="ts">
import { DcLoading } from '@/index'

import DemoSection from '../DemoSection.vue'
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="loading-appearances"
      title="尺寸、颜色与描边"
      description="size、color 和 strokeWidth 可以组合出不同层级的加载提示。"
    >
      <div
        class="flex min-h-36 flex-wrap items-center justify-around gap-8 rounded-lg bg-[var(--nui-card-color)] p-6"
      >
        <DcLoading :size="20" color="#18a058" :stroke-width="3" />
        <DcLoading :size="32" color="#2080f0" :stroke-width="5" />
        <DcLoading size="3rem" color="#d03050" :stroke-width="8" />
      </div>
    </DemoSection>

    <DemoSection
      section-id="loading-layouts"
      title="文字、方向与暂停"
      description="默认插槽提供说明文字，vertical 控制排布，spinning 可暂停动画。"
    >
      <div
        class="grid min-h-36 grid-cols-1 place-items-center gap-8 rounded-lg bg-[var(--nui-card-color)] p-6 sm:grid-cols-3"
      >
        <DcLoading :size="24" :text-size="13" color="var(--nui-primary-color)">加载章节</DcLoading>
        <DcLoading vertical :size="32" text-size="12px" color="#f0a020">同步书架</DcLoading>
        <DcLoading :spinning="false" :size="28" color="var(--nui-text-color-3)">已暂停</DcLoading>
      </div>
    </DemoSection>
  </div>
</template>