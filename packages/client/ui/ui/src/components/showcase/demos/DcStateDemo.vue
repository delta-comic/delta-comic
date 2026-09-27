<script setup lang="ts">
import { DcState } from '@/index'

import DemoSection from '../DemoSection.vue'

const states = [
  { label: '成功', value: { data: { count: 12 }, status: 'success' } },
  { label: '加载', value: { data: { count: 8 }, status: 'pending' } },
  { label: '失败', value: { data: null, error: new Error('无法连接到书架服务'), status: 'error' } },
] as const
</script>

<template>
  <div class="grid gap-6">
    <DemoSection
      section-id="state-statuses"
      title="成功、加载与错误"
      description="同一内容插槽会根据 DataState.status 叠加加载或错误反馈。"
    >
      <div class="grid gap-4 md:grid-cols-3">
        <article
          v-for="state in states"
          :key="state.label"
          class="rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] p-4"
        >
          <p class="mb-3 text-xs font-semibold text-[var(--nui-text-color-3)]">{{ state.label }}</p>
          <DcState
            :state="state.value as any"
            content-class="min-h-20 flex items-center justify-center"
          >
            <template #default="{ data }">
              <strong class="text-lg text-[var(--nui-text-color-1)]">{{
                data ? `${data.count} 本漫画` : '暂无数据'
              }}</strong>
            </template>
          </DcState>
        </article>
      </div>
    </DemoSection>

    <DemoSection
      section-id="state-content"
      title="内容与容器定制"
      description="contentClass 调整内容区域，class 和 style 仍可控制最外层状态容器。"
    >
      <DcState
        :state="{ data: { title: 'Delta Comic', progress: 72 }, status: 'success' } as any"
        class="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-5"
        content-class="flex items-center justify-between gap-4"
      >
        <template #default="{ data }">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">{{ data?.title }}</span>
          <span class="text-sm text-emerald-600 dark:text-emerald-400">{{ data?.progress }}%</span>
        </template>
      </DcState>
    </DemoSection>
  </div>
</template>