<script setup lang="ts">
import { marketplaceListingSource } from '@delta-comic/plugin'
import { NAlert, NButton, NModal, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PluginIcon from '@/components/plugin/PluginIcon.vue'
import type { PluginMarketplaceItem } from '@/features/pluginMarketplace/model'

const props = defineProps<{ item?: PluginMarketplaceItem }>()
const emit = defineEmits<{ install: []; openSource: [url: string] }>()
const show = defineModel<boolean>('show', { required: true })
const { locale, t } = useI18n()

const title = computed(
  () =>
    props.item?.manifest?.name.display ??
    props.item?.listing.repository?.name ??
    props.item?.listing.id,
)
const source = computed(() => (props.item ? marketplaceListingSource(props.item.listing) : ''))
const publishedAt = computed(() => {
  const value = props.item?.listing.release?.publishedAt
  return value
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
    : undefined
})
const canInstall = computed(
  () =>
    props.item?.compatibility !== 'incompatible' &&
    (!props.item?.installed || props.item.updateAvailable),
)
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="title"
    class="w-[min(92vw,620px)]!"
    :bordered="false"
  >
    <div v-if="item" class="grid gap-4">
      <div class="flex items-center gap-4">
        <PluginIcon
          :icon="item.installed?.meta.icon ?? item.manifest?.icon"
          :name="title ?? item.listing.id"
          :plugin-id="item.installed?.pluginName"
          size="large"
        />
        <p class="m-0 text-(--nui-text-color-2)">
          {{ item.manifest?.description ?? t('plugin.market.noDescription') }}
        </p>
      </div>
      <dl
        class="m-0 grid grid-cols-2 gap-3 *:min-w-0 *:rounded-[10px] *:bg-[color-mix(in_srgb,var(--dc-surface)_88%,var(--nui-primary-color))] *:p-2.5 max-[520px]:grid-cols-1 [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-xs [&_dt]:text-(--nui-text-color-3)"
      >
        <div>
          <dt>{{ t('plugin.market.details.installId') }}</dt>
          <dd>
            <code>ap:{{ item.listing.id }}</code>
          </dd>
        </div>
        <div>
          <dt>{{ t('plugin.market.details.authors') }}</dt>
          <dd>{{ item.listing.authors.join(', ') }}</dd>
        </div>
        <div v-if="item.listing.release">
          <dt>{{ t('plugin.market.details.release') }}</dt>
          <dd>{{ item.listing.release.version }}</dd>
        </div>
        <div v-if="publishedAt">
          <dt>{{ t('plugin.market.details.publishedAt') }}</dt>
          <dd>{{ publishedAt }}</dd>
        </div>
        <div v-if="item.manifest">
          <dt>{{ t('plugin.market.details.supportCore') }}</dt>
          <dd>{{ item.manifest.version.supportCore }}</dd>
        </div>
        <div>
          <dt>{{ t('plugin.market.details.manifest') }}</dt>
          <dd>
            <NTag size="small" :type="item.manifest ? 'success' : 'default'">
              {{
                item.manifest
                  ? t('plugin.market.details.manifestVerified')
                  : t('plugin.market.details.manifestFallback')
              }}
            </NTag>
          </dd>
        </div>
      </dl>
      <NAlert v-if="item.manifestError" type="warning" :title="t('plugin.market.errors.manifest')">
        {{ item.manifestError }}
      </NAlert>
      <NAlert type="info" :title="t('plugin.market.security.title')">
        {{ t('plugin.market.security.notice') }}
      </NAlert>
      <div class="flex justify-end gap-2.5">
        <NButton secondary @click="emit('openSource', source)">
          {{ t('plugin.market.actions.source') }}
        </NButton>
        <NButton type="primary" :disabled="!canInstall" @click="emit('install')">
          {{
            item.updateAvailable
              ? t('plugin.market.actions.update')
              : t('plugin.market.actions.install')
          }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>