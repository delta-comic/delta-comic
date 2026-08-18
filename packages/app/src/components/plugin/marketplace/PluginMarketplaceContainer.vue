<script setup lang="ts">
import { installPlugin, updatePlugin } from '@delta-comic/plugin'
import { useDialog, useMessage } from 'naive-ui'
import { computed, onMounted, shallowReactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePluginInstall } from '@/features/pluginInstall/usePluginInstall'
import {
  pluginMarketplaceInstallInput,
  pluginMarketplaceSourceUrl,
  type PluginMarketplaceItem,
} from '@/features/pluginMarketplace/model'
import { usePluginMarketplace } from '@/features/pluginMarketplace/usePluginMarketplace'
import { openExternal } from '@/platform'

import pkg from '../../../../package.json'

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()
const selectedItem = shallowRef<PluginMarketplaceItem>()
const detailsOpen = shallowRef(false)
const installingIds = shallowReactive(new Set<string>())
const confirmingIds = shallowReactive(new Set<string>())
const marketplace = usePluginMarketplace({ coreVersion: pkg.version })
const { runPluginInstall } = usePluginInstall()

const filterModel = computed({ get: () => marketplace.filter.value, set: marketplace.setFilter })
const queryModel = computed({ get: () => marketplace.query.value, set: marketplace.setQuery })

const showDetails = (item: PluginMarketplaceItem) => {
  selectedItem.value = item
  detailsOpen.value = true
}

const runInstall = async (item: PluginMarketplaceItem) => {
  if (installingIds.has(item.listing.id)) return
  confirmingIds.delete(item.listing.id)
  installingIds.add(item.listing.id)
  try {
    const title = t(
      item.installed ? 'plugin.progress.updateTitle' : 'plugin.progress.installTitle',
      item.installed
        ? { plugin: item.manifest?.name.display ?? item.listing.id }
        : { file: item.manifest?.name.display ?? item.listing.id },
    )
    await runPluginInstall(title, options =>
      item.installed
        ? updatePlugin(item.installed, options)
        : installPlugin(pluginMarketplaceInstallInput(item.listing), options),
    )
    await marketplace.refreshInstalled()
    message.success(
      t(item.installed ? 'plugin.market.messages.updated' : 'plugin.market.messages.installed'),
    )
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  } finally {
    installingIds.delete(item.listing.id)
  }
}

const confirmInstall = (item: PluginMarketplaceItem) => {
  if (item.compatibility === 'incompatible' || (item.installed && !item.updateAvailable)) return
  if (installingIds.has(item.listing.id) || confirmingIds.has(item.listing.id)) return
  confirmingIds.add(item.listing.id)
  const source = pluginMarketplaceSourceUrl(item.listing)
  const insecureNotice = source.startsWith('http:')
    ? `\n${t('plugin.market.security.insecure')}`
    : ''
  let confirmed = false
  const instance = dialog.warning({
    title: t(
      item.installed ? 'plugin.market.confirm.updateTitle' : 'plugin.market.confirm.installTitle',
    ),
    content: `${t('plugin.market.confirm.source', { source })}\n${t('plugin.market.security.notice')}${insecureNotice}`,
    positiveText: t(
      item.installed ? 'plugin.market.actions.update' : 'plugin.market.actions.install',
    ),
    negativeText: t('plugin.market.actions.cancel'),
    onPositiveClick: () => {
      if (confirmed) return false
      confirmed = true
      instance.loading = true
      instance.negativeButtonProps = { disabled: true }
      instance.closable = false
      instance.maskClosable = false
      instance.closeOnEsc = false
      return runInstall(item)
    },
    onAfterLeave: () => {
      confirmingIds.delete(item.listing.id)
    },
  })
}

const detailsBusy = computed(() => {
  const item = selectedItem.value
  return item ? installingIds.has(item.listing.id) || confirmingIds.has(item.listing.id) : false
})

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
        :confirming-ids="confirmingIds"
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
      :busy="detailsBusy"
      :item="selectedItem"
      @install="selectedItem && confirmInstall(selectedItem)"
      @open-source="openExternal"
    />
  </div>
</template>