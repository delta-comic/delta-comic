<script setup lang="ts">
import { NAlert, NButton, NEmpty, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import type { PluginMarketplaceItem } from '@/features/pluginMarketplace/model'

defineProps<{
  error?: Error
  hasMore: boolean
  installingIds: ReadonlySet<string>
  items: PluginMarketplaceItem[]
  loading: boolean
  loadingMore: boolean
}>()
const emit = defineEmits<{
  details: [item: PluginMarketplaceItem]
  install: [item: PluginMarketplaceItem]
  loadMore: []
  retry: []
}>()
const { t } = useI18n()
</script>

<template>
  <NSpin :show="loading" class="min-h-full!">
    <div class="grid gap-3.5 p-3.5">
      <NAlert v-if="error" type="error" :title="t('plugin.market.errors.title')">
        <div class="flex items-center justify-between gap-3">
          <span>{{ error.message }}</span>
          <NButton size="small" secondary type="error" @click="emit('retry')">
            {{ t('plugin.market.actions.retry') }}
          </NButton>
        </div>
      </NAlert>

      <NEmpty
        v-if="!loading && items.length === 0 && !error"
        :description="t('plugin.market.empty')"
        class="min-h-[260px] justify-center"
      />

      <TransitionGroup
        v-else
        tag="div"
        class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3"
        enter-active-class="transition duration-160 ease-in-out"
        leave-active-class="transition duration-160 ease-in-out"
        enter-from-class="translate-y-1.5 opacity-0"
        leave-to-class="translate-y-1.5 opacity-0"
      >
        <PluginMarketplaceCard
          v-for="item in items"
          :key="item.listing.id"
          :item="item"
          :installing="installingIds.has(item.listing.id)"
          @details="emit('details', item)"
          @install="emit('install', item)"
        />
      </TransitionGroup>

      <div v-if="items.length > 0" class="flex items-center justify-center gap-3 pt-2 pb-4.5">
        <NButton
          v-if="hasMore"
          secondary
          type="primary"
          :loading="loadingMore"
          @click="emit('loadMore')"
        >
          {{ t('plugin.market.actions.loadMore') }}
        </NButton>
        <span v-else class="text-[0.8rem] text-(--nui-text-color-3)">
          {{ t('plugin.market.end') }}
        </span>
      </div>
    </div>
  </NSpin>
</template>