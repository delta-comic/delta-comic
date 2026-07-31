<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { NButton } from 'naive-ui'
import { computed, ref } from 'vue'

import { DcWaterfall } from '@/index'

import DemoSection from '../DemoSection.vue'

interface CardItem {
  id: number
  title: string
  height: number
  tone: string
}

const length = ref(30)
const items = computed<CardItem[]>(() =>
  Array.from({ length: length.value }, (_, index) => ({
    id: index + 1,
    title: `漫画卡片 ${String(index + 1).padStart(2, '0')}`,
    height: 96 + (index % 5) * 24,
    tone: ['bg-emerald-500/10', 'bg-sky-500/10', 'bg-violet-500/10'][index % 3],
  })),
)

const query = useQuery({ key: () => ['waterfall-test'], query: async () => items.value })
</script>

<template>
  <div class="grid gap-6">
    <DemoSection description="" title="数据操作" section-id="waterfall-data-action">
      <NButton @click="length++">+1</NButton>
    </DemoSection>
    <DemoSection
      section-id="waterfall-columns"
      title="固定列与响应式列"
      description="col 可传固定数字，也可传 [min, max] 让组件按容器宽度选择列数。"
    >
      <div class="grid gap-4 xl:grid-cols-2">
        <div
          v-for="option in [
            { label: '固定 2 列', col: 2 as const },
            { label: '响应式 1-3 列', col: [1, 3] as [number, number] },
          ]"
          :key="option.label"
          class="overflow-hidden rounded-lg border border-(--nui-divider-color) bg-(--nui-card-color)"
        >
          <p
            class="border-b border-(--nui-divider-color) px-4 py-2 text-xs font-semibold text-(--nui-text-color-3)"
          >
            {{ option.label }}
          </p>
          <div class="h-[420px]">
            <DcWaterfall
              :source="{ type: 'array' as const, value: items }"
              :col="option.col"
              :gap="8"
              :padding="8"
              :min-height="96"
              class="size-full"
            >
              <template #default="{ item, index, length }">
                <article
                  class="flex flex-col rounded-lg border border-(--nui-divider-color) p-4"
                  :class="item.tone"
                  :style="{ minHeight: `${item.height}px` }"
                >
                  <span class="text-[10px] font-semibold text-(--nui-primary-color)"
                    >{{ index + 1 }}/{{ length }}</span
                  >
                  <strong class="mt-3 text-sm text-(--nui-text-color-1)">{{ item.title }}</strong>
                  <span class="mt-auto pt-3 text-xs text-(--nui-text-color-3)"
                    >{{ item.height }}px</span
                  >
                </article>
              </template>
            </DcWaterfall>
          </div>
        </div>
      </div>
    </DemoSection>

    <DemoSection
      section-id="waterfall-spacing"
      title="间距、内边距与刷新"
      description="gap、padding 和 minHeight 决定初始布局；unReloadable 控制下拉刷新能力。"
    >
      <div
        class="h-[440px] overflow-hidden rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]"
      >
        <DcWaterfall
          :source="{ type: 'query', value: query }"
          :col="[2, 4]"
          :gap="16"
          :padding="20"
          :min-height="120"
          class="size-full"
        >
          <template #default="{ item, height, minHeight }">
            <article
              class="rounded-xl border border-dashed border-[var(--nui-divider-color)] bg-[var(--nui-action-color)] p-4"
              :style="{ minHeight: `${item.height}px` }"
            >
              <strong class="text-sm text-[var(--nui-text-color-1)]">{{ item.title }}</strong>
              <p class="mt-3 text-xs leading-5 text-[var(--nui-text-color-3)]">
                初始 {{ minHeight }}px · 已测量 {{ Math.round(height ?? 0) || '等待' }}
              </p>
            </article>
          </template>
        </DcWaterfall>
      </div>
    </DemoSection>
  </div>
</template>