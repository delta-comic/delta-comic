<script setup vapor lang="ts">
defineProps<{ title: string; path: string }>()
</script>

<template>
  <div class="min-w-0">
    <div class="truncate text-sm font-semibold text-dc-text">{{ title }}</div>
    <div class="mt-1 truncate text-xs text-dc-text-secondary">{{ path }}</div>
  </div>
</template>