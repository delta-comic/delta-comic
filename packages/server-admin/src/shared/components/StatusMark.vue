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
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--dc-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.status-mark__dot {
  width: 8px;
  height: 8px;
  background: #98a2b1;
  border-radius: 1px;
}

.status-mark--success .status-mark__dot {
  background: var(--dc-green);
}

.status-mark--warning .status-mark__dot {
  background: #e0a000;
}

.status-mark--danger .status-mark__dot {
  background: var(--dc-red);
}

.status-mark--success {
  color: #176f3f;
}

.status-mark--warning {
  color: #8b6300;
}

.status-mark--danger {
  color: #a42d31;
}
</style>