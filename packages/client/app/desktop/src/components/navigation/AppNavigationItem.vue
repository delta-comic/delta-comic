<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ active: boolean; icon?: Component; label: string; to: string }>()
</script>

<template>
  <RouterLink
    :aria-current="active ? 'page' : undefined"
    :to
    :class="{ 'bg-[color-mix(in_srgb,var(--p-color)_10%,transparent)] text-dc-primary!': active }"
    class="app-navigation-item flex h-15 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-dc-text-tertiary no-underline hover:bg-dc-page"
  >
    <NIcon class="shrink-0" size="26">
      <component v-if="icon" :is="icon" />
    </NIcon>
    <span class="max-w-full dc-ellipsis text-xs leading-none">{{ label }}</span>
  </RouterLink>
</template>