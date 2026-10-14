<script setup lang="ts">
import { computed } from 'vue'

import type { StatusTone } from './types'

const props = withDefaults(defineProps<{ label: string; tone?: StatusTone }>(), { tone: 'muted' })

const toneClasses: Record<StatusTone, { dot: string; text: string }> = {
  danger: { dot: 'bg-danger', text: 'text-danger-foreground' },
  muted: { dot: 'bg-status-muted', text: 'text-foreground-secondary' },
  success: { dot: 'bg-success', text: 'text-success-foreground' },
  warning: { dot: 'bg-warning', text: 'text-warning-foreground' },
}

const classes = computed(() => toneClasses[props.tone])
</script>

<template>
  <span
    class="status-mark inline-flex items-center gap-2 text-[13px] whitespace-nowrap"
    :class="[`status-mark--${tone}`, classes.text]"
  >
    <span class="status-mark__dot size-2 rounded-[1px]" :class="classes.dot" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>