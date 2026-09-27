<script setup lang="ts">
import { NTag } from 'naive-ui'
import { shallowRef } from 'vue'

import { DcImage } from '@/index'

import DemoSection from '../DemoSection.vue'

const landscapeUrl = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#70c0e8"/><stop offset="1" stop-color="#d9f7be"/></linearGradient></defs>
    <rect width="640" height="360" fill="url(#sky)"/>
    <circle cx="500" cy="80" r="38" fill="#f2c97d"/>
    <path d="m0 300 160-150 100 90 110-125 270 245H0Z" fill="#18a058" fill-opacity=".78"/>
    <path d="m0 330 180-105 100 70 125-90 235 155H0Z" fill="#0c7a43"/>
  </svg>
`)}`

const portraitUrl = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320">
    <rect width="240" height="320" fill="#8a2be2"/>
    <circle cx="120" cy="110" r="58" fill="#f9f9f9"/>
    <path d="M32 320c8-83 37-124 88-124s80 41 88 124" fill="#63e2b7"/>
  </svg>
`)}`

const brokenUrl = 'data:image/png;base64,broken-image-data'
const eventStatus = shallowRef('等待交互')
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="image-fits"
      title="适配与形状"
      description="在相同容器中比较 cover、contain 与圆形裁切。"
    >
      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article>
          <div class="h-44 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
            <DcImage
              :src="landscapeUrl"
              alt="山景插画，cover 适配"
              fit="cover"
              class="size-full"
              :img-prop="{ class: 'h-full object-cover' }"
            />
          </div>
          <div class="mt-2 text-sm font-medium text-[var(--nui-text-color-1)]">cover</div>
        </article>
        <article>
          <div class="h-44 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
            <DcImage
              :src="portraitUrl"
              alt="人物插画，contain 适配"
              fit="contain"
              class="size-full"
              :img-prop="{ class: 'h-full object-contain' }"
            />
          </div>
          <div class="mt-2 text-sm font-medium text-[var(--nui-text-color-1)]">contain</div>
        </article>
        <article class="flex flex-col items-center sm:col-span-2 xl:col-span-1">
          <DcImage
            :src="portraitUrl"
            alt="圆形人物图标"
            fit="cover"
            round
            class="size-36 bg-slate-200 dark:bg-slate-800"
            :img-prop="{ class: 'size-full object-cover' }"
          />
          <div class="mt-2 text-sm font-medium text-[var(--nui-text-color-1)]">round</div>
        </article>
      </div>
    </DemoSection>

    <DemoSection
      section-id="image-states"
      title="加载与失败"
      description="失败资源可以显示回退图，也可以展示可点击重试的自定义状态。"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <article
          class="overflow-hidden rounded-xl border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
        >
          <DcImage
            :src="brokenUrl"
            :fallback="landscapeUrl"
            alt="失败后显示的回退图"
            fit="cover"
            :retry-max="0"
            class="h-40 w-full"
            :img-prop="{ class: 'h-full object-cover' }"
          />
          <div class="p-3">
            <div class="font-medium text-[var(--nui-text-color-1)]">fallback</div>
            <div class="mt-1 text-xs text-[var(--nui-text-color-3)]">
              主资源失败后切换本地回退图
            </div>
          </div>
        </article>

        <article
          class="overflow-hidden rounded-xl border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
        >
          <DcImage
            :src="brokenUrl"
            alt="加载失败演示"
            fit="cover"
            :retry-max="0"
            class="h-40 w-full"
            @error="eventStatus = '资源加载失败'"
          >
            <template #loading>
              <div class="flex size-full flex-col items-center justify-center gap-2 bg-rose-500/10">
                <span class="text-2xl" aria-hidden="true">↻</span>
                <span class="text-xs text-rose-600 dark:text-rose-400">点击重新加载</span>
              </div>
            </template>
          </DcImage>
          <div class="p-3">
            <div class="font-medium text-[var(--nui-text-color-1)]">自定义状态插槽</div>
            <div class="mt-1 text-xs text-[var(--nui-text-color-3)]">retryMax = 0</div>
          </div>
        </article>
      </div>
    </DemoSection>

    <DemoSection
      section-id="image-options"
      title="选项与事件"
      description="预览、优先级、原生图片属性与组件事件可以组合使用。"
    >
      <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
        <DcImage
          :src="landscapeUrl"
          alt="可预览山景插画"
          previewable
          inline
          fetchpriority="high"
          fit="cover"
          class="h-32 w-52 shrink-0 overflow-hidden rounded-xl"
          :img-prop="{ class: 'h-full object-cover', decoding: 'async' }"
          @load="eventStatus = '已触发 load'"
          @click="eventStatus = '已触发 click，可打开预览'"
          @error="eventStatus = '已触发 error'"
        />
        <div class="min-w-0 flex-1 space-y-3">
          <div class="flex flex-wrap gap-2">
            <NTag type="success" :bordered="false">previewable</NTag>
            <NTag type="info" :bordered="false">fetchpriority=high</NTag>
            <NTag :bordered="false">decoding=async</NTag>
          </div>
          <p class="text-sm text-[var(--nui-text-color-2)]">点击图片观察 click 与预览行为。</p>
          <NTag size="small" type="warning" :bordered="false">{{ eventStatus }}</NTag>
        </div>
      </div>
    </DemoSection>
  </div>
</template>