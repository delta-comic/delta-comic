<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ active: boolean; icon?: Component; label: string; to: string }>()
</script>

<template>
  <RouterLink
    :aria-current="active ? 'page' : undefined"
    :class="{ 'text-dc-primary ': active }"
    :to="to"
    class="app-navigation-item row-start-1 flex h-full min-w-0 flex-col items-center justify-center gap-1 text-dc-text-tertiary no-underline [transition:color_160ms_ease,transform_160ms_ease] hover:text-dc-primary active:scale-[0.94]"
  >
    <NIcon
      class="shrink-0 transition-transform duration-160"
      :class="{ '-translate-y-px scale-[1.06]': active }"
      size="26"
    >
      <component v-if="icon" :is="icon" />
    </NIcon>
    <span class="max-w-full dc-ellipsis text-xs leading-none">{{ label }}</span>
  </RouterLink>
</template>