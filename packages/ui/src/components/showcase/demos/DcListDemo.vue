<script setup lang="ts">
import { NTag } from 'naive-ui'

import { DcList } from '@/index'

import DemoSection from '../DemoSection.vue'

interface ListItem {
  id: number
  title: string
  description: string
}

const items: ListItem[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  title: `章节 ${String(index + 1).padStart(2, '0')}`,
  description:
    index % 4 === 0 ? '包含附加信息的可变高度列表项，用于验证自动测量。' : '标准章节信息',
}))
const source = { type: 'array' as const, value: items }
</script>

<template>
  <div class="grid gap-6">
    <DemoSection
      section-id="list-heights"
      title="紧凑与宽松的高度策略"
      description="minHeight 是虚拟列表的初始测量基准，插槽同时获得 index、height、length 等布局信息。"
    >
      <div class="grid gap-4 xl:grid-cols-2">
        <div
          v-for="option in [
            { label: '紧凑 52px', height: 52 },
            { label: '宽松 84px', height: 84 },
          ]"
          :key="option.height"
          class="overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
        >
          <p
            class="border-b border-[var(--nui-divider-color)] px-4 py-2 text-xs font-semibold text-[var(--nui-text-color-3)]"
          >
            {{ option.label }}
          </p>
          <div class="h-80">
            <DcList :source="source" :min-height="option.height" class="size-full">
              <template #default="{ item, index, minHeight, length }">
                <article
                  class="flex w-full items-center gap-3 border-b border-[var(--nui-divider-color)] px-4 py-2"
                  :style="{ minHeight: `${minHeight}px` }"
                >
                  <span
                    class="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/12 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >{{ index + 1 }}</span
                  >
                  <span class="min-w-0 flex-1">
                    <strong class="block text-sm text-[var(--nui-text-color-1)]">{{
                      item.title
                    }}</strong>
                    <small
                      v-if="option.height > 60"
                      class="mt-1 block text-[var(--nui-text-color-3)]"
                      >{{ item.description }}</small
                    >
                  </span>
                  <NTag size="tiny" :bordered="false">{{ index + 1 }}/{{ length }}</NTag>
                </article>
              </template>
            </DcList>
          </div>
        </div>
      </div>
    </DemoSection>

    <DemoSection
      section-id="list-refresh"
      title="刷新手势开关"
      description="unReloadable 会禁用内部下拉刷新，适合只读记录或由页面统一刷新的列表。"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="option in [
            { label: '允许下拉刷新', disabled: false },
            { label: '禁用下拉刷新', disabled: true },
          ]"
          :key="option.label"
          class="overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
        >
          <p
            class="border-b border-[var(--nui-divider-color)] px-4 py-2 text-xs font-semibold text-[var(--nui-text-color-3)]"
          >
            {{ option.label }}
          </p>
          <div class="h-56">
            <DcList
              :source="{ type: 'array', value: items.slice(0, 12) }"
              :min-height="56"
              :un-reloadable="option.disabled"
              class="size-full"
            >
              <template #default="{ item, index }">
                <div
                  class="flex min-h-14 items-center border-b border-[var(--nui-divider-color)] px-4 text-sm text-[var(--nui-text-color-2)]"
                >
                  {{ index + 1 }} · {{ item.title }}
                </div>
              </template>
            </DcList>
          </div>
        </div>
      </div>
      <template #note>下拉手势仅在触摸设备启用；桌面端可对照配置与普通滚动行为。</template>
    </DemoSection>
  </div>
</template>