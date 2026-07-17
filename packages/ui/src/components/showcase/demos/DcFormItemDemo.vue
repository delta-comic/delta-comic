<script setup lang="ts">
import type { FormNumber, FormString, FormSwitch } from '@delta-comic/model'
import { NForm } from 'naive-ui'
import { reactive } from 'vue'

import { DcFormItem } from '@/index'

import DemoSection from '../DemoSection.vue'

const nameConfig: FormString = {
  type: 'string',
  info: '作品名称',
  placeholder: '输入作品名称',
  defaultValue: 'Delta Comic',
}
const countConfig: FormNumber = {
  type: 'number',
  info: '同时下载数',
  placeholder: '1 至 8',
  range: [1, 8],
  defaultValue: 3,
}
const switchConfig: FormSwitch = {
  type: 'switch',
  info: '自动缓存',
  open: '开启',
  close: '关闭',
  defaultValue: true,
}
const typeValues = reactive({ name: 'Delta Comic', count: 3, enabled: true })

const requiredConfig: FormString = {
  type: 'string',
  info: '必填账号',
  placeholder: '不可留空',
  required: true,
}
const optionalConfig: FormString = {
  type: 'string',
  info: '备注',
  placeholder: '可选输入',
  required: false,
}
const requiredValues = reactive({ account: 'delta-reader', note: '' })
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-item-types"
      title="配置类型"
      description="DcFormItem 根据 config.type 分派到不同输入控件，并统一标签与路径。"
    >
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <NForm :model="typeValues" class="rounded-lg bg-[var(--nui-card-color)] p-5">
          <DcFormItem v-model="typeValues.name" path="name" :config="nameConfig" />
          <DcFormItem v-model="typeValues.count" path="count" :config="countConfig" />
          <DcFormItem v-model="typeValues.enabled" path="enabled" :config="switchConfig" />
        </NForm>
        <pre
          class="overflow-auto rounded-lg bg-black/5 p-4 text-xs leading-5 text-[var(--nui-text-color-2)] dark:bg-white/5"
          >{{ JSON.stringify(typeValues, null, 2) }}</pre
        >
      </div>
      <template #note>示例同时覆盖 string、number 与 switch 三种鉴别类型。</template>
    </DemoSection>

    <DemoSection
      section-id="form-item-required"
      title="必填与说明"
      description="required 会传递给表单项布局；info 作为标签，placeholder 描述输入预期。"
    >
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <NForm :model="requiredValues" class="rounded-lg bg-[var(--nui-card-color)] p-5">
          <DcFormItem v-model="requiredValues.account" path="account" :config="requiredConfig" />
          <DcFormItem v-model="requiredValues.note" path="note" :config="optionalConfig" />
        </NForm>
        <pre
          class="overflow-auto rounded-lg bg-black/5 p-4 text-xs leading-5 text-[var(--nui-text-color-2)] dark:bg-white/5"
          >{{ JSON.stringify(requiredValues, null, 2) }}</pre
        >
      </div>
      <template #note>未声明 required 时组件按必填处理；显式 false 会移除必填标识。</template>
    </DemoSection>
  </div>
</template>