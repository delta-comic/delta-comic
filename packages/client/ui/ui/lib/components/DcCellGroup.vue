<script setup lang="ts">
import { cn } from '@/utils'

defineOptions({ inheritAttrs: false })
defineProps<{ title?: string; inset?: boolean; border?: boolean }>()

defineSlots<{ title(): any; default(): any }>()
</script>

<template>
  <div v-bind="$attrs">
    <template v-if="title || $slots.title">
      <div
        :class="
          cn(
            'dc-cell-group__title p-[var(--dc-cell-group-title-padding,var(--dc-space-4))] text-[length:var(--dc-cell-group-title-font-size,var(--dc-font-size-md))] leading-[var(--dc-cell-group-title-line-height,16px)] text-[color:var(--dc-cell-group-title-color,var(--dc-color-text-secondary))]',
            inset &&
              'dc-cell-group__title--inset p-[var(--dc-cell-group-inset-title-padding,var(--dc-space-4))]',
          )
        "
      >
        <slot v-if="$slots.title" name="title" />
        <template v-else>{{ title }}</template>
      </div>
    </template>
    <div
      :class="
        cn(
          'dc-cell-group [background:var(--dc-cell-group-background,var(--dc-color-surface))]',
          inset &&
            'dc-cell-group--inset [margin:var(--dc-cell-group-inset-padding,0_var(--dc-space-4))] overflow-hidden rounded-[var(--dc-cell-group-inset-radius,var(--dc-radius-lg))]',
          border && !inset && 'dc-hairline-top-bottom',
        )
      "
    >
      <slot />
    </div>
  </div>
</template>