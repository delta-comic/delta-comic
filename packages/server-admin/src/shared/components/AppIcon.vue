<script setup lang="ts">
import type { AppIconName } from './types'

defineProps<{ name: AppIconName; size?: number }>()
</script>

<template>
  <svg
    class="app-icon"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'home'">
      <path d="m3 10 9-7 9 7" />
      <path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7" />
    </template>
    <template v-else-if="name === 'plugins'">
      <rect x="3" y="3" width="7" height="7" rx="1.3" />
      <rect x="14" y="3" width="7" height="7" rx="1.3" />
      <rect x="3" y="14" width="7" height="7" rx="1.3" />
      <rect x="14" y="14" width="7" height="7" rx="1.3" />
    </template>
    <template v-else-if="name === 'metrics'">
      <path d="M3 3v18h18" />
      <path d="m6.5 15 4-4 3 2 5-6" />
    </template>
    <template v-else-if="name === 'cube'">
      <path d="m12 2.8 8.5 4.7v9L12 21.2l-8.5-4.7v-9L12 2.8Z" />
      <path d="m3.8 7.7 8.2 4.6 8.2-4.6M12 12.3v8.4" />
    </template>
    <template v-else-if="name === 'api'">
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" />
    </template>
    <template v-else-if="name === 'gear'">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M20 6v5h-5" />
      <path d="M19 11a7.5 7.5 0 1 0 .2 3" />
    </template>
    <template v-else-if="name === 'copy'">
      <rect x="8" y="8" width="11" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v10A1.5 1.5 0 0 0 5.5 17H8" />
    </template>
    <template v-else-if="name === 'menu'">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m5 5 14 14M19 5 5 19" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="m9 5 7 7-7 7" />
    </template>
  </svg>
</template>

<style scoped>
.app-icon {
  @apply [display:block];
  @apply [flex:none];
}
</style>