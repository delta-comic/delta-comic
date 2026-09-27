<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'
import { shallowRef } from 'vue'

import { DcPullRefresh } from '@/index'

import DemoSection from '../DemoSection.vue'

const refreshing = shallowRef(false)
const pulling = shallowRef(false)
const refreshCount = shallowRef(0)

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration))
const refresh = async () => {
  await wait(650)
  refreshCount.value++
}
const previewRefresh = async () => {
  refreshing.value = true
  await refresh()
  refreshing.value = false
}
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="pull-refresh-control"
      title="刷新与拉动状态"
      description="refreshing 和 pulling 两个 model 分别反映刷新任务与手势过程。"
    >
      <template #actions>
        <NButton size="small" type="primary" :loading="refreshing" @click="previewRefresh"
          >模拟刷新</NButton
        >
      </template>
      <DcPullRefresh
        v-model:refreshing="refreshing"
        v-model:pulling="pulling"
        :disabled="false"
        :refresher="refresh"
        class="h-52 rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
        content-class="min-h-72 p-5"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--nui-text-color-2)]">在触屏设备向下拉动</span>
          <NTag type="success" :bordered="false">刷新 {{ refreshCount }} 次</NTag>
        </div>
        <p class="mt-5 text-xs leading-6 text-[var(--nui-text-color-3)]">
          pulling: {{ pulling }} · refreshing: {{ refreshing }}
        </p>
      </DcPullRefresh>
      <template #note
        >完整手势只在支持触摸且使用粗指针的设备启用；桌面端可用按钮观察受控状态。</template
      >
    </DemoSection>

    <DemoSection
      section-id="pull-refresh-options"
      title="触发距离与禁用状态"
      description="pullDistance 控制触发阈值；disabled 用于只保留普通滚动容器。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <DcPullRefresh
          :disabled="false"
          :refresher="refresh"
          :pull-distance="36"
          class="h-44 rounded-lg border border-emerald-500/25 bg-emerald-500/8"
          content-class="min-h-56 p-4 text-[var(--nui-text-color-2)]"
        >
          <strong class="text-sm">36px 灵敏阈值</strong>
          <p class="mt-2 text-xs opacity-70">短距离下拉即可触发。</p>
        </DcPullRefresh>
        <DcPullRefresh
          disabled
          :refresher="refresh"
          :pull-distance="90"
          class="h-44 rounded-lg border border-dashed border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
          content-class="min-h-56 p-4"
        >
          <strong class="text-sm text-[var(--nui-text-color-2)]">已禁用</strong>
          <p class="mt-2 text-xs text-[var(--nui-text-color-3)]">保留纵向滚动，不响应下拉刷新。</p>
        </DcPullRefresh>
      </div>
    </DemoSection>
  </div>
</template>