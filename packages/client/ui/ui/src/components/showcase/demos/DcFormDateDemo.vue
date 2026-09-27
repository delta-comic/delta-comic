<script setup lang="ts">
import type { FormDate } from '@delta-comic/model'
import { shallowRef } from 'vue'

import { DcFormDate } from '@/index'

import DemoSection from '../DemoSection.vue'

const dateConfig: FormDate = {
  type: 'date',
  info: '更新日期',
  format: 'yyyy-MM-dd',
  time: true,
  defaultValue: '2026-07-17',
}
const dateTimeConfig: FormDate = {
  type: 'date',
  info: '发布时间',
  format: 'yyyy-MM-dd HH:mm:ss',
  time: false,
  defaultValue: '2026-07-17 09:18:06',
}
const dateValue = shallowRef('2026-07-17')
const dateTimeValue = shallowRef('2026-07-17 09:18:06')

const slashConfig: FormDate = {
  type: 'date',
  info: '斜线日期',
  format: 'MM/dd/yyyy',
  time: true,
  defaultValue: '07/17/2026',
}
const dottedConfig: FormDate = {
  type: 'date',
  info: '点分日期',
  format: 'yyyy.MM.dd',
  time: true,
  defaultValue: '2026.07.17',
}
const slashValue = shallowRef('07/17/2026')
const dottedValue = shallowRef('2026.07.17')
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-date-modes"
      title="日期模式"
      description="time=true 选择纯日期，time=false 同时采集日期和时间。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">纯日期</span>
          <DcFormDate v-model="dateValue" :config="dateConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">model: {{ dateValue }}</code>
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">日期时间</span>
          <DcFormDate v-model="dateTimeValue" :config="dateTimeConfig" />
          <code class="block text-xs break-all text-[var(--nui-text-color-3)]">
            model: {{ dateTimeValue }}
          </code>
        </label>
      </div>
      <template #note
        >组件使用 formatted-value，因此 v-model 始终是与 format 对应的字符串。</template
      >
    </DemoSection>

    <DemoSection
      section-id="form-date-formats"
      title="输出格式"
      description="同一日期模式可使用不同 format，v-model 会直接反映字符串差异。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">MM/dd/yyyy</span>
          <DcFormDate v-model="slashValue" :config="slashConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">model: {{ slashValue }}</code>
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">yyyy.MM.dd</span>
          <DcFormDate v-model="dottedValue" :config="dottedConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">model: {{ dottedValue }}</code>
        </label>
      </div>
      <template #note>input-readonly 会阻止手动输入不符合格式的文本，日期由面板选择。</template>
    </DemoSection>
  </div>
</template>