<script setup lang="ts" generic="T">
const $props = defineProps<{ value: T }>()

defineSlots<{ default(arg: { value: T }): any }>()
</script>

<template>
  <slot :value="$props.value" />
</template>