<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'
import { shallowRef } from 'vue'

import { DcTab } from '@/index'

import DemoSection from '../DemoSection.vue'

const compactActive = shallowRef('recommend')
const equalActive = shallowRef('bookshelf')
const items = [
  { name: 'recommend', title: '推荐' },
  { name: 'bookshelf', title: '书架' },
  { name: 'history', title: '历史记录' },
  { name: 'downloads', title: '离线下载' },
]
</script>

<template>
  <div class="grid gap-6">
    <DemoSection
      section-id="tab-local"
      title="本地受控标签"
      description="router=false 时使用 v-model:active 管理选中项，shrink 让标签宽度跟随内容。"
    >
      <div
        class="overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
      >
        <DcTab v-model:active="compactActive" :items="items" :router="false" shrink />
        <div class="p-6 text-sm text-[var(--nui-text-color-2)]">当前标签：{{ compactActive }}</div>
      </div>
    </DemoSection>

    <DemoSection
      section-id="tab-layout"
      title="等宽、滑动与插槽"
      description="shrink=false 时标签等宽；swipeable 开启滑动切换，左右和底部插槽可承载附加操作。"
    >
      <div
        class="overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
      >
        <DcTab
          v-model:active="equalActive"
          :items="items.slice(0, 3)"
          :router="false"
          :shrink="false"
          swipeable
          mode="push"
        >
          <template #left><NTag class="ml-3" size="small" :bordered="false">LOCAL</NTag></template>
          <template #right><NButton class="mr-3" size="tiny" quaternary>管理</NButton></template>
          <template #bottom>
            <div
              class="border-t border-[var(--nui-divider-color)] px-4 py-3 text-xs text-[var(--nui-text-color-3)]"
            >
              bottom slot · {{ equalActive }}
            </div>
          </template>
        </DcTab>
      </div>
    </DemoSection>
  </div>
</template>