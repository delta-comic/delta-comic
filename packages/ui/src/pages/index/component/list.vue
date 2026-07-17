<script setup lang="ts">
import { NTag } from 'naive-ui'

import { DcList, DcWaterfall } from '@/index'

import DemoSection from '../../../components/showcase/DemoSection.vue'

interface ListItem {
  id: number
  title: string
  description: string
  height: number
}

const listItems: ListItem[] = Array.from({ length: 32 }, (_, index) => ({
  id: index + 1,
  title: `章节 ${String(index + 1).padStart(2, '0')}`,
  description: index % 3 === 0 ? '包含较长的补充说明，用于观察可变内容高度。' : '标准列表项目',
  height: 84 + (index % 4) * 24,
}))

const listSource = { type: 'array' as const, value: listItems }
const waterfallItems = listItems.slice(0, 18)
const waterfallSource = { type: 'array' as const, value: waterfallItems }
</script>

<template>
  <div class="space-y-6">
    <DemoSection title="基础列表" description="单列虚拟化渲染，适合章节、历史记录等纵向数据。">
      <div
        class="h-[420px] overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
      >
        <DcList :source="listSource" :min-height="72" class="size-full">
          <template #default="{ item, index, minHeight }">
            <article
              class="flex w-full items-center gap-4 border-b border-[var(--nui-divider-color)] px-4 py-3 last:border-b-0"
              :style="{ minHeight: `${minHeight}px` }"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                :class="
                  index % 3 === 0
                    ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                    : index % 3 === 1
                      ? 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
                      : 'bg-violet-500/12 text-violet-600 dark:text-violet-400'
                "
              >
                {{ item.id }}
              </span>
              <span class="min-w-0 flex-1">
                <strong class="block text-sm font-medium text-[var(--nui-text-color-1)]">
                  {{ item.title }}
                </strong>
                <span class="mt-1 block text-xs leading-5 text-[var(--nui-text-color-3)]">
                  {{ item.description }}
                </span>
              </span>
              <NTag size="small" :bordered="false">#{{ item.id }}</NTag>
            </article>
          </template>
        </DcList>
      </div>
      <template #note
        >向下滚动时仅保留视口附近的 DOM 节点；下拉动作可触发 source 的刷新函数。</template
      >
    </DemoSection>

    <DemoSection
      title="响应式瀑布流"
      description="列数会在 1 到 3 之间自适应，组件自动测量不同高度的内容卡片。"
    >
      <div
        class="h-[460px] overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
      >
        <DcWaterfall
          :source="waterfallSource"
          :col="[1, 3]"
          :min-height="84"
          :gap="12"
          :padding="12"
          class="size-full"
        >
          <template #default="{ item, index }">
            <article
              class="flex flex-col overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] p-4"
              :style="{ minHeight: `${item.height}px` }"
            >
              <span class="text-xs font-semibold text-[var(--nui-primary-color)]">
                CARD {{ String(index + 1).padStart(2, '0') }}
              </span>
              <strong class="mt-3 text-sm text-[var(--nui-text-color-1)]">{{ item.title }}</strong>
              <span class="mt-2 text-xs leading-5 text-[var(--nui-text-color-3)]">
                {{ item.description }}
              </span>
              <span class="mt-auto pt-4 text-[10px] text-[var(--nui-text-color-3)]">
                {{ item.height }}px
              </span>
            </article>
          </template>
        </DcWaterfall>
      </div>
      <template #note>卡片高度变化时由统一的 ResizeObserver 更新尺寸缓存，避免重复监听。</template>
    </DemoSection>
  </div>
</template>