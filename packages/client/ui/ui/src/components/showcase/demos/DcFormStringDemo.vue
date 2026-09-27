<script setup lang="ts">
import type { FormString } from '@delta-comic/model'
import { shallowRef } from 'vue'

import { DcFormString } from '@/index'

import DemoSection from '../DemoSection.vue'

const namedConfig: FormString = {
  type: 'string',
  info: '昵称',
  placeholder: '输入阅读者昵称',
  defaultValue: '阿尔法读者',
}
const emptyConfig: FormString = {
  type: 'string',
  info: '签名',
  placeholder: '尚未填写签名',
  required: false,
}
const namedValue = shallowRef('阿尔法读者')
const emptyValue = shallowRef('')

const digitsConfig: FormString = {
  type: 'string',
  info: '数字编号',
  placeholder: '仅允许数字',
  patten: /^\d+$/,
}
const freeConfig: FormString = { type: 'string', info: '自由标签', placeholder: '可输入任意文本' }
const digitsValue = shallowRef('20260717')
const freeValue = shallowRef('Sci-Fi / 异世界')
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-string-types"
      title="初始值与空值"
      description="defaultValue 可表达预设内容，placeholder 为空值提供输入指引。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">预设昵称</span>
          <DcFormString v-model="namedValue" :config="namedConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(namedValue) }}
          </code>
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">可选签名</span>
          <DcFormString v-model="emptyValue" :config="emptyConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(emptyValue) }}
          </code>
        </label>
      </div>
      <template #note>两个输入框均可清空，v-model 会立即同步字符串值。</template>
    </DemoSection>

    <DemoSection
      section-id="form-string-pattern"
      title="占位与模式"
      description="patten 正则可限制新输入，同时始终允许清空；未配置时接受任意文本。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">仅数字</span>
          <DcFormString v-model="digitsValue" :config="digitsConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(digitsValue) }}
          </code>
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">不限制内容</span>
          <DcFormString v-model="freeValue" :config="freeConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(freeValue) }}
          </code>
        </label>
      </div>
      <template #note>尝试在“仅数字”输入框中键入字母，可观察 allowInput 的过滤效果。</template>
    </DemoSection>
  </div>
</template>