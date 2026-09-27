<script setup lang="ts">
import { NRadioButton, NRadioGroup, NTag } from 'naive-ui'
import { computed, shallowRef } from 'vue'

import { DcContent } from '@/index'

import DemoSection from '../DemoSection.vue'

type StateName = 'success' | 'loading' | 'empty' | 'error'

const stateName = shallowRef<StateName>('success')
const retryCount = shallowRef(0)
const stateSource = computed(() => ({
  type: 'raw' as const,
  data:
    stateName.value === 'success'
      ? ['章节 01', '章节 02', '章节 03']
      : stateName.value === 'loading'
        ? undefined
        : [],
  isLoading: stateName.value === 'loading',
  error: stateName.value === 'error' ? new Error('请求超时，请稍后重试') : undefined,
  refetch: () => {
    retryCount.value++
    stateName.value = 'success'
  },
}))

const retainedSources = [
  {
    label: '加载并保留数据',
    source: { type: 'raw' as const, data: ['第 28 话', '第 29 话'], isLoading: true },
  },
  {
    label: '错误并保留数据',
    source: {
      type: 'raw' as const,
      data: ['缓存章节'],
      isLoading: false,
      error: new Error('更新失败，正在显示缓存'),
    },
  },
]
</script>

<template>
  <div class="grid gap-6">
    <DemoSection
      section-id="content-states"
      title="可切换的内容状态"
      description="raw source 可以明确表达加载、成功、空数据和错误，并为错误态提供重试函数。"
    >
      <template #actions>
        <NRadioGroup v-model:value="stateName" size="small">
          <NRadioButton value="success">成功</NRadioButton>
          <NRadioButton value="loading">加载</NRadioButton>
          <NRadioButton value="empty">空</NRadioButton>
          <NRadioButton value="error">错误</NRadioButton>
        </NRadioGroup>
      </template>
      <div
        class="h-72 overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
      >
        <DcContent
          :source="stateSource"
          class="p-5"
          class-empty="opacity-80"
          class-error="max-w-lg"
        >
          <template #default="{ data }">
            <div class="grid gap-3 sm:grid-cols-3">
              <article
                v-for="item in data"
                :key="item"
                class="rounded-lg bg-[var(--nui-action-color)] p-4 text-sm text-[var(--nui-text-color-1)]"
              >
                {{ item }}
              </article>
            </div>
          </template>
        </DcContent>
      </div>
      <template #note>错误态中的“重试”会切回成功状态；已重试 {{ retryCount }} 次。</template>
    </DemoSection>

    <DemoSection
      section-id="content-retained"
      title="加载或错误时保留旧数据"
      description="source 仍有 data 时，状态提示会收缩到角落，内容不会被遮挡。"
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <article
          v-for="item in retainedSources"
          :key="item.label"
          class="h-44 overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
        >
          <DcContent :source="item.source" class="p-5">
            <template #default="{ data }">
              <p class="text-xs text-[var(--nui-text-color-3)]">{{ item.label }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <NTag v-for="value in data" :key="value" :bordered="false">{{ value }}</NTag>
              </div>
            </template>
          </DcContent>
        </article>
      </div>
    </DemoSection>

    <DemoSection
      section-id="content-overrides"
      title="隐藏默认反馈与自定义样式"
      description="hideLoading、hideError、hideEmpty 可用于由上层接管状态反馈。"
    >
      <div class="grid gap-4 md:grid-cols-3">
        <DcContent
          v-for="item in [
            {
              label: 'hideLoading',
              props: { hideLoading: true },
              source: { type: 'raw', data: [], isLoading: true },
            },
            {
              label: 'hideEmpty',
              props: { hideEmpty: true },
              source: { type: 'raw', data: [], isLoading: false },
            },
            {
              label: 'hideError',
              props: { hideError: true },
              source: { type: 'raw', data: [], isLoading: false, error: new Error('hidden') },
            },
          ]"
          :key="item.label"
          v-bind="item.props"
          :source="item.source as any"
          class="flex h-28 items-center justify-center rounded-lg border border-dashed border-[var(--nui-divider-color)]"
        >
          <span class="text-xs text-[var(--nui-text-color-3)]">{{ item.label }}：由上层呈现</span>
        </DcContent>
      </div>
    </DemoSection>
  </div>
</template>