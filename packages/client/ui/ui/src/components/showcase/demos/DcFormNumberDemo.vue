<script setup lang="ts">
import type { FormNumber } from '@delta-comic/model'
import { shallowRef } from 'vue'

import { DcFormNumber } from '@/index'

import DemoSection from '../DemoSection.vue'

const boundedConfig: FormNumber = {
  type: 'number',
  info: '并发数',
  placeholder: '1 至 8',
  range: [1, 8],
  defaultValue: 3,
}
const signedConfig: FormNumber = {
  type: 'number',
  info: '顺序偏移',
  placeholder: '-10 至 10',
  range: [-10, 10],
  defaultValue: 0,
}
const boundedValue = shallowRef(3)
const signedValue = shallowRef(0)

const integerConfig: FormNumber = {
  type: 'number',
  info: '章节数',
  placeholder: '仅整数',
  float: false,
  defaultValue: 12,
}
const floatConfig: FormNumber = {
  type: 'number',
  info: '缩放比例',
  placeholder: '允许小数',
  float: true,
  range: [0.5, 3],
  defaultValue: 1.25,
}
const integerValue = shallowRef(12)
const floatValue = shallowRef(1.25)
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-number-range"
      title="数值范围"
      description="range 同时设置 min 与 max，可表达正数区间或包含负数的范围。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">并发数 · 1–8</span>
          <DcFormNumber v-model="boundedValue" :config="boundedConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]"
            >model: {{ boundedValue }}</code
          >
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">偏移 · -10–10</span>
          <DcFormNumber v-model="signedValue" :config="signedConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">model: {{ signedValue }}</code>
        </label>
      </div>
      <template #note>清空按钮会把当前模型更新为空值；上下界由输入控件直接约束。</template>
    </DemoSection>

    <DemoSection
      section-id="form-number-precision"
      title="整数与小数"
      description="float=false 将 precision 固定为 0，float=true 则保留输入小数。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">整数章节</span>
          <DcFormNumber v-model="integerValue" :config="integerConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]"
            >model: {{ integerValue }}</code
          >
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">小数缩放</span>
          <DcFormNumber v-model="floatValue" :config="floatConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">model: {{ floatValue }}</code>
        </label>
      </div>
      <template #note>小数示例同时使用 0.5–3 的范围，便于区分精度与边界两个配置。</template>
    </DemoSection>
  </div>
</template>