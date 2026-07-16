<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ title?: string; inset?: boolean; border?: boolean }>()

defineSlots<{ title(): any; default(): any }>()
</script>

<template>
  <div v-bind="$attrs">
    <template v-if="title || $slots.title">
      <div :class="{ 'dc-cell-group__title--inset': inset }" class="dc-cell-group__title">
        <slot v-if="$slots.title" name="title" />
        <template v-else>{{ title }}</template>
      </div>
    </template>
    <div
      :class="{ 'dc-cell-group--inset': inset, 'dc-hairline-top-bottom': border && !inset }"
      class="dc-cell-group"
    >
      <slot />
    </div>
  </div>
</template>

<style>
:root,
:host {
  --dc-cell-group-background: var(--dc-color-surface);
  --dc-cell-group-title-color: var(--dc-color-text-secondary);
  --dc-cell-group-title-padding: var(--dc-space-4) var(--dc-space-4);
  --dc-cell-group-title-font-size: var(--dc-font-size-md);
  --dc-cell-group-title-line-height: 16px;
  --dc-cell-group-inset-padding: 0 var(--dc-space-4);
  --dc-cell-group-inset-radius: var(--dc-radius-lg);
  --dc-cell-group-inset-title-padding: var(--dc-space-4) var(--dc-space-4);
}

.dc-cell-group {
  background: var(--dc-cell-group-background);
}

.dc-cell-group--inset {
  margin: var(--dc-cell-group-inset-padding);
  border-radius: var(--dc-cell-group-inset-radius);
  overflow: hidden;
}

.dc-cell-group__title {
  padding: var(--dc-cell-group-title-padding);
  color: var(--dc-cell-group-title-color);
  font-size: var(--dc-cell-group-title-font-size);
  line-height: var(--dc-cell-group-title-line-height);
}

.dc-cell-group__title--inset {
  padding: var(--dc-cell-group-inset-title-padding);
}
</style>