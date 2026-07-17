<script setup lang="ts">
import type { FormSwitch } from '@delta-comic/model'
import { shallowRef } from 'vue'

import { DcFormSwitch } from '@/index'

import DemoSection from '../DemoSection.vue'

const labeledConfig: FormSwitch = {
  type: 'switch',
  info: '自动下载',
  open: '开启',
  close: '关闭',
  defaultValue: true,
}
const statusConfig: FormSwitch = {
  type: 'switch',
  info: '网络状态',
  open: '在线',
  close: '离线',
  defaultValue: false,
}
const labeledValue = shallowRef(true)
const statusValue = shallowRef(false)

const enabledConfig: FormSwitch = { type: 'switch', info: '启用漫画预加载', defaultValue: true }
const disabledConfig: FormSwitch = {
  type: 'switch',
  info: '开启实验模式',
  defaultValue: false,
  required: false,
}
const enabledValue = shallowRef(true)
const disabledValue = shallowRef(false)
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-switch-labels"
      title="状态文案"
      description="open 和 close 分别定义开启与关闭时的插槽文案。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label
          class="flex items-center justify-between gap-4 rounded-lg bg-[var(--nui-card-color)] p-5"
        >
          <span>
            <strong class="block text-sm text-[var(--nui-text-color-1)]">下载状态</strong>
            <code class="mt-1 block text-xs text-[var(--nui-text-color-3)]">
              model: {{ labeledValue }}
            </code>
          </span>
          <DcFormSwitch v-model="labeledValue" :config="labeledConfig" />
        </label>
        <label
          class="flex items-center justify-between gap-4 rounded-lg bg-[var(--nui-card-color)] p-5"
        >
          <span>
            <strong class="block text-sm text-[var(--nui-text-color-1)]">网络状态</strong>
            <code class="mt-1 block text-xs text-[var(--nui-text-color-3)]">
              model: {{ statusValue }}
            </code>
          </span>
          <DcFormSwitch v-model="statusValue" :config="statusConfig" />
        </label>
      </div>
      <template #note>两组相反默认状态用于同时观察 checked 与 unchecked 文案。</template>
    </DemoSection>

    <DemoSection
      section-id="form-switch-defaults"
      title="默认状态"
      description="不提供 open/close 时呈现紧凑开关，defaultValue 可表达开启或关闭预设。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label
          class="flex items-center justify-between gap-4 rounded-lg bg-[var(--nui-card-color)] p-5"
        >
          <span>
            <strong class="block text-sm text-[var(--nui-text-color-1)]">默认开启</strong>
            <code class="mt-1 block text-xs text-[var(--nui-text-color-3)]">
              model: {{ enabledValue }}
            </code>
          </span>
          <DcFormSwitch v-model="enabledValue" :config="enabledConfig" />
        </label>
        <label
          class="flex items-center justify-between gap-4 rounded-lg bg-[var(--nui-card-color)] p-5"
        >
          <span>
            <strong class="block text-sm text-[var(--nui-text-color-1)]">默认关闭</strong>
            <code class="mt-1 block text-xs text-[var(--nui-text-color-3)]">
              model: {{ disabledValue }}
            </code>
          </span>
          <DcFormSwitch v-model="disabledValue" :config="disabledConfig" />
        </label>
      </div>
      <template #note
        >required 属于表单布局配置；直接使用控件时仍由外层决定是否展示必填标识。</template
      >
    </DemoSection>
  </div>
</template>