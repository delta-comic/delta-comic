<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'

defineProps<{ packageName: string; version: string }>()

const emit = defineEmits<{ openNavigation: [] }>()
</script>

<template>
  <header
    class="z-30 flex h-16 shrink-0 items-center border-b border-[var(--nui-divider-color)] bg-[var(--nui-card-color)]/95 px-4 backdrop-blur sm:px-6"
  >
    <div class="mx-auto flex w-full max-w-[1600px] items-center gap-3">
      <span class="lg:hidden">
        <NButton quaternary circle aria-label="打开组件导航" @click="emit('openNavigation')">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            class="size-5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </NButton>
      </span>

      <a href="/" class="flex min-w-0 items-center gap-3 no-underline">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--nui-primary-color)] text-lg font-black text-white shadow-sm"
          aria-hidden="true"
        >
          Δ
        </span>
        <span class="min-w-0">
          <strong class="block truncate text-base text-[var(--nui-text-color-1)]">Delta UI</strong>
          <span class="hidden truncate text-xs text-[var(--nui-text-color-3)] sm:block">
            {{ packageName }}
          </span>
        </span>
      </a>

      <div class="ml-auto flex items-center gap-2 sm:gap-4">
        <NTag size="small" :bordered="false" round type="success">v{{ version }}</NTag>
        <a
          href="https://github.com/delta-comic/delta-comic"
          target="_blank"
          rel="noreferrer"
          class="rounded-md px-2 py-1 text-sm font-medium text-[var(--nui-text-color-2)] no-underline transition-colors hover:text-[var(--nui-primary-color)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nui-primary-color)]"
        >
          GitHub
        </a>
      </div>
    </div>
  </header>
</template>