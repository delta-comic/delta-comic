<script setup lang="ts">
import type { FormRadio } from '@delta-comic/model'
import { shallowRef } from 'vue'

import { DcFormRadio } from '@/index'

import DemoSection from '../DemoSection.vue'

const readingModeOptions = [
  { label: '单页', value: 'single' },
  { label: '双页', value: 'double' },
  { label: '条漫', value: 'strip' },
]
const buttonConfig: FormRadio = {
  type: 'radio',
  info: '阅读模式',
  comp: 'radio',
  selects: readingModeOptions,
  defaultValue: 'single',
}
const compactButtonConfig: FormRadio = {
  type: 'radio',
  info: '翻页方向',
  comp: 'radio',
  selects: [
    { label: '从左到右', value: 'ltr' },
    { label: '从右到左', value: 'rtl' },
  ],
  defaultValue: 'rtl',
}
const buttonValue = shallowRef('single')
const directionValue = shallowRef('rtl')

const selectConfig: FormRadio = {
  type: 'radio',
  info: '图像质量',
  comp: 'select',
  placeholder: '搜索并选择质量',
  selects: [
    { label: '节省流量', value: 'low' },
    { label: '平衡', value: 'balanced' },
    { label: '原图', value: 'original' },
  ],
  defaultValue: 'balanced',
}
const emptySelectConfig: FormRadio = {
  type: 'radio',
  info: '默认分类',
  comp: 'select',
  placeholder: '未选择分类',
  selects: [
    { label: '收藏', value: 'favorite' },
    { label: '历史', value: 'history' },
    { label: '订阅', value: 'subscribe' },
  ],
}
const selectValue = shallowRef('balanced')
const emptySelectValue = shallowRef('')
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-radio-buttons"
      title="单选按钮组"
      description="comp=radio 使所有 selects 直接可见，适合选项较少的场景。"
    >
      <div class="space-y-5 rounded-lg bg-[var(--nui-card-color)] p-5">
        <label class="grid gap-2">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">阅读模式</span>
          <DcFormRadio v-model="buttonValue" :config="buttonConfig" />
          <code class="text-xs text-[var(--nui-text-color-3)]">model: {{ buttonValue }}</code>
        </label>
        <label class="grid gap-2">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">翻页方向</span>
          <DcFormRadio v-model="directionValue" :config="compactButtonConfig" />
          <code class="text-xs text-[var(--nui-text-color-3)]">model: {{ directionValue }}</code>
        </label>
      </div>
      <template #note>每个选项使用 label 显示文案，并把对应 value 写入模型。</template>
    </DemoSection>

    <DemoSection
      section-id="form-radio-select"
      title="下拉选择"
      description="comp=select 将相同 selects 投影为可搜索下拉框，placeholder 用于空状态。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">有默认值</span>
          <DcFormRadio v-model="selectValue" :config="selectConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">model: {{ selectValue }}</code>
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">空状态</span>
          <DcFormRadio v-model="emptySelectValue" :config="emptySelectConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(emptySelectValue) }}
          </code>
        </label>
      </div>
      <template #note>下拉模式会启用 filterable，选项较多时更节省空间。</template>
    </DemoSection>
  </div>
</template>