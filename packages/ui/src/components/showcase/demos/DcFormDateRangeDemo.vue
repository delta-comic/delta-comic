<script setup lang="ts">
import type { FormDateRange } from '@delta-comic/model'
import { ref } from 'vue'

import { DcFormDateRange } from '@/index'

import DemoSection from '../DemoSection.vue'

const rangeConfig: FormDateRange = {
  type: 'dateRange',
  info: '阅读统计周期',
  format: 'yyyy-MM-dd',
  time: true,
  defaultValue: ['2026-07-01', '2026-07-17'],
}
const dateTimeRangeConfig: FormDateRange = {
  type: 'dateRange',
  info: '同步时段',
  format: 'yyyy-MM-dd HH:mm',
  time: false,
  defaultValue: ['2026-07-17 08:00', '2026-07-17 18:00'],
}
const rangeValue = ref<[string, string]>(['2026-07-01', '2026-07-17'])
const dateTimeRangeValue = ref<[string, string]>(['2026-07-17 08:00', '2026-07-17 18:00'])

const slashRangeConfig: FormDateRange = {
  type: 'dateRange',
  info: '月/日/年',
  format: 'MM/dd/yyyy',
  time: true,
  defaultValue: ['07/01/2026', '07/17/2026'],
}
const dottedRangeConfig: FormDateRange = {
  type: 'dateRange',
  info: '点分格式',
  format: 'yyyy.MM.dd',
  time: true,
  defaultValue: ['2026.07.01', '2026.07.17'],
}
const slashRangeValue = ref<[string, string]>(['07/01/2026', '07/17/2026'])
const dottedRangeValue = ref<[string, string]>(['2026.07.01', '2026.07.17'])
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-date-range-modes"
      title="范围模式"
      description="time=true 使用日期范围，time=false 使用包含时分的日期时间范围。"
    >
      <div class="space-y-4">
        <label class="grid gap-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">日期范围</span>
          <DcFormDateRange v-model="rangeValue" :config="rangeConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(rangeValue) }}
          </code>
        </label>
        <label class="grid gap-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">日期时间范围</span>
          <DcFormDateRange v-model="dateTimeRangeValue" :config="dateTimeRangeConfig" />
          <code class="block text-xs break-all text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(dateTimeRangeValue) }}
          </code>
        </label>
      </div>
      <template #note>v-model 是固定两个位置的元组，依次表示起始与结束时间。</template>
    </DemoSection>

    <DemoSection
      section-id="form-date-range-formats"
      title="范围格式"
      description="format 同时应用于范围两端，适合按存储或展示约定输出。"
    >
      <div class="space-y-4">
        <label class="grid gap-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">MM/dd/yyyy</span>
          <DcFormDateRange v-model="slashRangeValue" :config="slashRangeConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(slashRangeValue) }}
          </code>
        </label>
        <label class="grid gap-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">yyyy.MM.dd</span>
          <DcFormDateRange v-model="dottedRangeValue" :config="dottedRangeConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(dottedRangeValue) }}
          </code>
        </label>
      </div>
      <template #note>两端值均可通过弹出面板调整，模型输出始终遵循所选格式。</template>
    </DemoSection>
  </div>
</template>