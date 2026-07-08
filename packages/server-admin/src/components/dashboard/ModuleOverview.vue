<script setup lang="ts">
import type { ServerModuleDefinition } from '@delta-comic/server-config'

defineProps<{ modules: readonly ServerModuleDefinition[] }>()
</script>

<template>
  <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
    <NGridItem v-for="module in modules" :key="module.key">
      <NCard :title="module.name" hoverable class="h-full">
        <NSpace vertical size="small">
          <NText>{{ module.description }}</NText>
          <NTag size="small" type="info">{{ module.apiPrefix }}</NTag>
          <NSpace v-if="module.cloudflareBindings.length" size="small">
            <NTag v-for="binding in module.cloudflareBindings" :key="binding" size="small">
              {{ binding }} binding
            </NTag>
          </NSpace>
        </NSpace>
      </NCard>
    </NGridItem>
  </NGrid>
</template>