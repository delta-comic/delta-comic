<script setup lang="ts">
import { NEmpty, NInput } from 'naive-ui'
import { computed } from 'vue'

import type { ShowcaseNavItem } from './types'

const props = defineProps<{ items: readonly ShowcaseNavItem[]; activeName?: string }>()
const keyword = defineModel<string>('keyword', { default: '' })

const emit = defineEmits<{ select: [item: ShowcaseNavItem] }>()

const visibleItems = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLocaleLowerCase()
  if (!normalizedKeyword) return props.items

  return props.items.filter(item =>
    `${item.label} ${item.description}`.toLocaleLowerCase().includes(normalizedKeyword),
  )
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-[var(--nui-card-color)] px-3 py-5">
    <div class="px-2 lg:hidden">
      <NInput v-model:value="keyword" clearable placeholder="搜索组件" aria-label="搜索组件" />
    </div>

    <div class="mt-6 flex min-h-0 flex-1 flex-col lg:mt-1">
      <p
        class="mb-2 px-3 text-xs font-semibold tracking-[0.14em] text-[var(--nui-text-color-3)] uppercase"
      >
        Components
      </p>
      <nav aria-label="组件导航" class="min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
        <button
          v-for="item in visibleItems"
          :key="item.name"
          type="button"
          class="group relative flex w-full items-center rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nui-primary-color)]"
          :class="
            item.name === activeName
              ? 'bg-[color-mix(in_srgb,var(--nui-primary-color)_12%,transparent)] text-[var(--nui-primary-color)]'
              : 'text-[var(--nui-text-color-2)] hover:bg-[var(--nui-action-color)] hover:text-[var(--nui-text-color-1)]'
          "
          :aria-current="item.name === activeName ? 'page' : undefined"
          @click="emit('select', item)"
        >
          <span
            class="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--nui-primary-color)] transition-opacity"
            :class="item.name === activeName ? 'opacity-100' : 'opacity-0'"
          />
          <span>
            <strong class="block text-sm font-medium">{{ item.label }}</strong>
            <span class="mt-0.5 block text-xs opacity-70">{{ item.description }}</span>
          </span>
        </button>
      </nav>

      <NEmpty
        v-if="visibleItems.length === 0"
        size="small"
        description="没有匹配的组件"
        class="py-10"
      />
    </div>

    <p
      class="mt-4 border-t border-[var(--nui-divider-color)] px-3 pt-4 text-xs text-[var(--nui-text-color-3)]"
    >
      Vue 3 · TypeScript · Tailwind CSS
    </p>
  </div>
</template>