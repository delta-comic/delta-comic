<script setup lang="ts">
import type { StatusTone } from './types'

withDefaults(defineProps<{ label: string; tone?: StatusTone }>(), { tone: 'muted' })
</script>

<template>
  <span class="status-mark" :class="`status-mark--${tone}`">
    <span class="status-mark__dot" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.status-mark {
  @apply [display:inline-flex];
  @apply [gap:8px];
  @apply [align-items:center];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:13px];
  @apply [white-space:nowrap];
}

.status-mark__dot {
  @apply [width:8px];
  @apply [height:8px];
  @apply [background:var(--dc-status-muted)];
  @apply [border-radius:1px];
}

.status-mark--success .status-mark__dot {
  @apply [background:var(--dc-green)];
}

.status-mark--warning .status-mark__dot {
  @apply [background:var(--dc-amber)];
}

.status-mark--danger .status-mark__dot {
  @apply [background:var(--dc-red)];
}

.status-mark--success {
  @apply [color:var(--dc-green-text)];
}

.status-mark--warning {
  @apply [color:var(--dc-amber-text)];
}

.status-mark--danger {
  @apply [color:var(--dc-red-text)];
}
</style>