<script setup lang="ts">
import type { FormConfigure, FormResult } from '@delta-comic/model'
import { NAlert, NButton, NInput } from 'naive-ui'
import { ref } from 'vue'

import { DcForm } from '@/index'

import DemoSection from '../DemoSection.vue'

const generatedConfigs = {
  title: {
    type: 'string',
    info: '漫画名称',
    placeholder: '输入作品名称',
    defaultValue: 'Delta Comic',
  },
  chapterCount: {
    type: 'number',
    info: '章节数',
    placeholder: '1 至 999',
    range: [1, 999],
    defaultValue: 24,
  },
  audience: {
    type: 'radio',
    info: '目标读者',
    comp: 'radio',
    selects: [
      { label: '全年龄', value: 'all' },
      { label: '青少年', value: 'teen' },
      { label: '成人', value: 'adult' },
    ],
    defaultValue: 'all',
  },
  features: {
    type: 'checkbox',
    info: '启用功能',
    comp: 'checkbox',
    selects: [
      { label: '缓存', value: 'cache' },
      { label: '同步', value: 'sync' },
      { label: '通知', value: 'notice' },
    ],
    defaultValue: ['cache'],
  },
  enabled: {
    type: 'switch',
    info: '立即启用',
    open: '已启用',
    close: '已停用',
    defaultValue: true,
  },
} satisfies FormConfigure

const generatedValue = ref<FormResult<typeof generatedConfigs>>({
  title: 'Delta Comic',
  chapterCount: 24,
  audience: 'all',
  features: ['cache'],
  enabled: true,
})

const overrideConfigs = {
  alias: {
    type: 'string',
    info: '展示别名',
    placeholder: '自定义行会接管此字段',
    required: false,
    defaultValue: '书架',
  },
  retries: { type: 'number', info: '重试次数', range: [0, 10], defaultValue: 3 },
} satisfies FormConfigure

const overrideValue = ref<FormResult<typeof overrideConfigs>>({ alias: '书架', retries: 3 })
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-generated"
      title="配置生成"
      description="一份配置同时生成文本、数字、单选、多选和开关控件。"
    >
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          class="rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] p-5"
        >
          <DcForm v-model="generatedValue" :configs="generatedConfigs" />
        </div>
        <div class="min-w-0">
          <p class="mb-2 text-xs font-semibold text-[var(--nui-text-color-2)]">CURRENT MODEL</p>
          <pre
            class="overflow-auto rounded-lg bg-black/5 p-4 text-xs leading-5 text-[var(--nui-text-color-2)] dark:bg-white/5"
            >{{ JSON.stringify(generatedValue, null, 2) }}</pre
          >
        </div>
      </div>
      <template #note>
        configs 的 type 鉴别字段决定控件，v-model 始终返回与配置同形的结果。
      </template>
    </DemoSection>

    <DemoSection
      section-id="form-overrides"
      title="行覆盖与插槽"
      description="override-row 可仅接管指定字段，top 和 bottom 插槽保留表单级布局。"
    >
      <div class="space-y-4">
        <DcForm v-model="overrideValue" :configs="overrideConfigs" :override-row="['alias']">
          <template #top>
            <NAlert type="info" :bordered="false" class="mb-4">
              只覆盖 alias 行，retries 仍由 DcFormItem 自动生成。
            </NAlert>
          </template>
          <template #row="{ modelValue, path, setModelValue }">
            <label class="mb-5 grid gap-2">
              <span class="text-sm font-medium text-[var(--nui-text-color-1)]">
                自定义行 · {{ path }}
              </span>
              <NInput
                :value="String(modelValue ?? '')"
                placeholder="由 row 插槽渲染"
                @update:value="setModelValue"
              />
            </label>
          </template>
          <template #bottom>
            <NButton type="primary" secondary>底部操作插槽</NButton>
          </template>
        </DcForm>
        <pre
          class="overflow-auto rounded-lg bg-black/5 p-4 text-xs leading-5 text-[var(--nui-text-color-2)] dark:bg-white/5"
          >{{ JSON.stringify(overrideValue, null, 2) }}</pre
        >
      </div>
      <template #note> overrideRow 为 true 时可覆盖全部行；数组模式仅覆盖指定 key。 </template>
    </DemoSection>
  </div>
</template>