<script setup lang="ts">
import { Install, marketplaceListingInstallId, marketplaceListingSource } from '@delta-comic/plugin'
import { useDialog, useMessage } from 'naive-ui'
import { computed, onMounted, shallowReactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PluginMarketplaceItem } from '@/features/pluginMarketplace/model'
import { usePluginMarketplace } from '@/features/pluginMarketplace/usePluginMarketplace'
import { openExternal } from '@/platform'

import pkg from '../../../../package.json'

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()
const selectedItem = shallowRef<PluginMarketplaceItem>()
const detailsOpen = shallowRef(false)
const installingIds = shallowReactive(new Set<string>())
const marketplace = usePluginMarketplace({ coreVersion: pkg.version })

const filterModel = computed({ get: () => marketplace.filter.value, set: marketplace.setFilter })
const queryModel = computed({ get: () => marketplace.query.value, set: marketplace.setQuery })

const showDetails = (item: PluginMarketplaceItem) => {
  selectedItem.value = item
  detailsOpen.value = true
}

const runInstall = async (item: PluginMarketplaceItem) => {
  if (installingIds.has(item.listing.id)) return
  installingIds.add(item.listing.id)
  try {
    if (item.installed) await Install.updatePlugin(item.installed)
    else await Install.installPlugin(marketplaceListingInstallId(item.listing))
    await marketplace.refreshInstalled()
    message.success(
      t(item.installed ? 'plugin.market.messages.updated' : 'plugin.market.messages.installed'),
    )
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
    throw error
  } finally {
    installingIds.delete(item.listing.id)
  }
}

const confirmInstall = (item: PluginMarketplaceItem) => {
  if (item.compatibility === 'incompatible' || (item.installed && !item.updateAvailable)) return
  const source = marketplaceListingSource(item.listing)
  const insecureNotice = source.startsWith('http:')
    ? `\n${t('plugin.market.security.insecure')}`
    : ''
  dialog.warning({
    title: t(
      item.installed ? 'plugin.market.confirm.updateTitle' : 'plugin.market.confirm.installTitle',
    ),
    content: `${t('plugin.market.confirm.source', { source })}\n${t('plugin.market.security.notice')}${insecureNotice}`,
    positiveText: t(
      item.installed ? 'plugin.market.actions.update' : 'plugin.market.actions.install',
    ),
    negativeText: t('plugin.market.actions.cancel'),
    onPositiveClick: () => runInstall(item),
  })
}

onMounted(() => void marketplace.refresh())
</script>

<template>
  <div
    class="flex size-full min-h-0 flex-col overflow-hidden bg-[color-mix(in_srgb,var(--dc-surface)_96%,var(--nui-primary-color))]"
  >
    <PluginMarketplaceFilters
      v-model:filter="filterModel"
      v-model:query="queryModel"
      :loading="marketplace.loading.value"
      :stale="marketplace.stale.value"
      :total="marketplace.items.value.length"
      @refresh="marketplace.refresh"
    />
    <NScrollbar class="min-h-0! flex-1">
      <PluginMarketplaceList
        :error="marketplace.error.value"
        :has-more="marketplace.hasMore.value"
        :installing-ids="installingIds"
        :items="marketplace.visibleItems.value"
        :loading="marketplace.loading.value"
        :loading-more="marketplace.loadingMore.value"
        @details="showDetails"
        @install="confirmInstall"
        @load-more="marketplace.loadMore"
        @retry="marketplace.retry"
      />
    </NScrollbar>
    <PluginMarketplaceDetails
      v-model:show="detailsOpen"
      :item="selectedItem"
      @install="selectedItem && confirmInstall(selectedItem)"
      @open-source="openExternal"
    />
  </div>
</template>