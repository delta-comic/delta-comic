<script setup lang="ts">
import type { FormPairs } from '@delta-comic/model'
import { ref } from 'vue'

import { DcFormPairs } from '@/index'

import DemoSection from '../DemoSection.vue'

const multipleConfig: FormPairs = {
  type: 'pairs',
  info: '请求头',
  defaultValue: [
    { key: 'Accept-Language', value: 'zh-CN' },
    { key: 'X-Reader', value: 'delta-comic' },
  ],
}
const emptyMultipleConfig: FormPairs = {
  type: 'pairs',
  info: '扩展参数',
  defaultValue: [{ key: '', value: '' }],
}
const multipleValue = ref([
  { key: 'Accept-Language', value: 'zh-CN' },
  { key: 'X-Reader', value: 'delta-comic' },
])
const emptyMultipleValue = ref([{ key: '', value: '' }])

const singleConfig: FormPairs = {
  type: 'pairs',
  info: '单一键值',
  noMultiple: true,
  defaultValue: [{ key: 'source', value: 'official' }],
}
const alternateSingleConfig: FormPairs = {
  type: 'pairs',
  info: '下载命令',
  noMultiple: true,
  defaultValue: [{ key: 'command', value: 'install' }],
}
const singleValue = ref([{ key: 'source', value: 'official' }])
const alternateSingleValue = ref([{ key: 'command', value: 'install' }])
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-pairs-multiple"
      title="多组键值"
      description="标准模式允许增加、删除和排序多行，每行包含 key 与 value。"
    >
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div class="space-y-6 rounded-lg bg-[var(--nui-card-color)] p-5">
          <label class="grid gap-2">
            <span class="text-sm font-medium text-[var(--nui-text-color-1)]">预设请求头</span>
            <DcFormPairs v-model="multipleValue" :config="multipleConfig" />
          </label>
          <label class="grid gap-2">
            <span class="text-sm font-medium text-[var(--nui-text-color-1)]">空白扩展行</span>
            <DcFormPairs v-model="emptyMultipleValue" :config="emptyMultipleConfig" />
          </label>
        </div>
        <pre
          class="overflow-auto rounded-lg bg-black/5 p-4 text-xs leading-5 text-[var(--nui-text-color-2)] dark:bg-white/5"
          >{{
            JSON.stringify({ headers: multipleValue, extras: emptyMultipleValue }, null, 2)
          }}</pre
        >
      </div>
      <template #note>on-create 会复用 defaultValue 首行的结构，并写入响应式数组模型。</template>
    </DemoSection>

    <DemoSection
      section-id="form-pairs-single"
      title="单组限制"
      description="noMultiple=true 将数据约束为一组键值，适合单一命令或映射配置。"
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <label class="grid gap-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">来源映射</span>
          <DcFormPairs v-model="singleValue" :config="singleConfig" />
          <code class="block text-xs break-all text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(singleValue) }}
          </code>
        </label>
        <label class="grid gap-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">命令映射</span>
          <DcFormPairs v-model="alternateSingleValue" :config="alternateSingleConfig" />
          <code class="block text-xs break-all text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(alternateSingleValue) }}
          </code>
        </label>
      </div>
      <template #note
        >两项示例使用不同默认键值，用于确认 noMultiple 下仍保持完整对象结构。</template
      >
    </DemoSection>
  </div>
</template>