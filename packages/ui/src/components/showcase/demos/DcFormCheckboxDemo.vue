<script setup lang="ts">
import type { FormCheckbox } from '@delta-comic/model'
import { ref } from 'vue'

import { DcFormCheckbox } from '@/index'

import DemoSection from '../DemoSection.vue'

const featureOptions = [
  { label: '离线缓存', value: 'cache' },
  { label: '跨端同步', value: 'sync' },
  { label: '更新通知', value: 'notice' },
]
const groupConfig: FormCheckbox = {
  type: 'checkbox',
  info: '阅读功能',
  comp: 'checkbox',
  selects: featureOptions,
  defaultValue: ['cache', 'sync'],
}
const emptyGroupConfig: FormCheckbox = {
  type: 'checkbox',
  info: '实验功能',
  comp: 'checkbox',
  selects: [
    { label: '预加载', value: 'preload' },
    { label: '动态滤镜', value: 'filter' },
  ],
}
const groupValue = ref<string[]>(['cache', 'sync'])
const emptyGroupValue = ref<string[]>([])

const selectConfig: FormCheckbox = {
  type: 'checkbox',
  info: '内容类型',
  comp: 'multipleSelect',
  placeholder: '搜索并选择多个类型',
  selects: [
    { label: '连载漫画', value: 'series' },
    { label: '短篇', value: 'short' },
    { label: '画集', value: 'art-book' },
    { label: '完结作品', value: 'completed' },
  ],
  defaultValue: ['series'],
}
const broadSelectConfig: FormCheckbox = {
  type: 'checkbox',
  info: '显示字段',
  comp: 'multipleSelect',
  placeholder: '可选多项',
  selects: [
    { label: '作者', value: 'author' },
    { label: '评分', value: 'rating' },
    { label: '更新时间', value: 'updatedAt' },
  ],
  defaultValue: ['author', 'rating'],
}
const selectValue = ref<string[]>(['series'])
const broadSelectValue = ref<string[]>(['author', 'rating'])
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="form-checkbox-group"
      title="复选框组"
      description="comp=checkbox 直接展开 selects，模型以字符串数组保存所有选中值。"
    >
      <div class="space-y-5 rounded-lg bg-[var(--nui-card-color)] p-5">
        <label class="grid gap-2">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">预选功能</span>
          <DcFormCheckbox v-model="groupValue" :config="groupConfig" />
          <code class="text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(groupValue) }}
          </code>
        </label>
        <label class="grid gap-2">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">无预选</span>
          <DcFormCheckbox v-model="emptyGroupValue" :config="emptyGroupConfig" />
          <code class="text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(emptyGroupValue) }}
          </code>
        </label>
      </div>
      <template #note>defaultValue 可表达初始组合，用户操作会持续更新同一个数组模型。</template>
    </DemoSection>

    <DemoSection
      section-id="form-checkbox-select"
      title="多选下拉"
      description="comp=multipleSelect 使用可搜索的虚拟多选列表，适合选项较多的配置。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">内容类型</span>
          <DcFormCheckbox v-model="selectValue" :config="selectConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(selectValue) }}
          </code>
        </label>
        <label class="space-y-2 rounded-lg bg-[var(--nui-card-color)] p-4">
          <span class="text-sm font-medium text-[var(--nui-text-color-1)]">显示字段</span>
          <DcFormCheckbox v-model="broadSelectValue" :config="broadSelectConfig" />
          <code class="block text-xs text-[var(--nui-text-color-3)]">
            model: {{ JSON.stringify(broadSelectValue) }}
          </code>
        </label>
      </div>
      <template #note
        >两组示例使用不同 options 和 placeholder，便于观察多值标签与搜索行为。</template
      >
    </DemoSection>
  </div>
</template>