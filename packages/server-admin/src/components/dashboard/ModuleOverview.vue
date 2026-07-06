<script setup lang="ts">
import type { ServerModuleDefinition } from '@delta-comic/server-config'

defineProps<{ modules: readonly ServerModuleDefinition[] }>()
</script>

<template>
  <n-grid cols="1 s:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
    <n-grid-item v-for="module in modules" :key="module.key">
      <n-card :title="module.name" hoverable class="h-full">
        <n-space vertical size="small">
          <n-text>{{ module.description }}</n-text>
          <n-tag size="small" type="info">{{ module.apiPrefix }}</n-tag>
          <n-space v-if="module.cloudflareBindings.length" size="small">
            <n-tag v-for="binding in module.cloudflareBindings" :key="binding" size="small">
              {{ binding }} binding
            </n-tag>
          </n-space>
        </n-space>
      </n-card>
    </n-grid-item>
  </n-grid>
</template>
