<script setup lang="ts">
import { NButton, NInput, NSelect, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PluginMarketplaceFilter } from '@/features/pluginMarketplace/model'

defineProps<{ loading: boolean; stale: boolean; total: number }>()
const emit = defineEmits<{ refresh: [] }>()
const query = defineModel<string>('query', { required: true })
const filter = defineModel<PluginMarketplaceFilter>('filter', { required: true })
const { t } = useI18n()

const filterOptions = computed(() => [
  { label: t('plugin.market.filters.all'), value: 'all' },
  { label: t('plugin.market.filters.available'), value: 'available' },
  { label: t('plugin.market.filters.installed'), value: 'installed' },
  { label: t('plugin.market.filters.updates'), value: 'updates' },
])
</script>

<template>
  <section
    class="grid gap-3 border-b border-dc-border bg-dc-surface p-4"
    :aria-label="t('plugin.market.filters.label')"
  >
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="m-0 text-[1.35rem] font-bold">{{ t('plugin.market.title') }}</h1>
        <p class="mt-0.5 mb-0 text-[0.82rem] text-(--nui-text-color-3)">
          {{ t('plugin.market.loadedCount', { count: total }) }}
        </p>
      </div>
      <NTag v-if="stale" type="warning" round>
        {{ t('plugin.market.stale') }}
      </NTag>
    </div>
    <div class="flex items-center justify-between gap-3 max-[640px]:flex-wrap">
      <NInput
        v-model:value="query"
        clearable
        :placeholder="t('plugin.market.searchPlaceholder')"
        class="min-w-[180px] flex-1 max-[640px]:basis-full"
      />
      <NSelect
        v-model:value="filter"
        :options="filterOptions"
        class="w-[150px] max-[640px]:min-w-0 max-[640px]:flex-1"
      />
      <NButton secondary type="primary" :loading="loading" @click="emit('refresh')">
        {{ t('plugin.market.actions.refresh') }}
      </NButton>
    </div>
  </section>
</template>