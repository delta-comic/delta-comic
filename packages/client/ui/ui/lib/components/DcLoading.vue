<script setup lang="ts">
import { isNumber } from 'es-toolkit/compat'
import { computed } from 'vue'

const $props = withDefaults(
  defineProps<{
    size?: string | number
    color?: string
    textSize?: string | number
    vertical?: boolean
    spinning?: boolean
    strokeWidth?: string | number
  }>(),
  { spinning: true, strokeWidth: 5 },
)

const spinnerSize = computed(() =>
  isNumber($props.size) ? `${$props.size}px` : ($props.size ?? '30px'),
)
const textSizeStr = computed(() =>
  isNumber($props.textSize) ? `${$props.textSize}px` : ($props.textSize ?? $props.size ?? '14px'),
)
const strokeWidthStr = computed(() =>
  isNumber($props.strokeWidth) ? `${$props.strokeWidth}` : ($props.strokeWidth ?? '5'),
)
</script>

<template>
  <div
    class="inline-flex items-center gap-1"
    :class="{ 'flex-col': vertical }"
    :style="{ color: $props.color }"
  >
    <svg
      :class="{ 'animate-spin': $props.spinning }"
      :width="spinnerSize"
      :height="spinnerSize"
      viewBox="0 0 50 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        stroke="currentColor"
        stroke-opacity="0.2"
        :stroke-width="strokeWidthStr"
      />
      <path
        d="M25 5a20 20 0 0 1 20 20"
        stroke="currentColor"
        :stroke-width="strokeWidthStr"
        stroke-linecap="round"
      />
    </svg>
    <span v-if="$slots.default" :style="{ fontSize: textSizeStr }">
      <slot />
    </span>
  </div>
</template>