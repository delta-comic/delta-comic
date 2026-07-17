<script setup lang="ts">
import { NButton, NCard, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PluginIcon from '@/components/plugin/PluginIcon.vue'
import type { PluginMarketplaceItem } from '@/features/pluginMarketplace/model'

const props = defineProps<{ installing: boolean; item: PluginMarketplaceItem }>()
const emit = defineEmits<{ details: []; install: [] }>()
const { t } = useI18n()

const displayName = computed(
  () =>
    props.item.manifest?.name.display ??
    props.item.listing.repository?.name ??
    props.item.listing.id,
)
const version = computed(
  () => props.item.manifest?.version.plugin ?? props.item.listing.release?.version,
)
const actionDisabled = computed(
  () =>
    props.item.compatibility === 'incompatible' ||
    Boolean(props.item.installed && !props.item.updateAvailable),
)
const actionLabel = computed(() => {
  if (props.item.updateAvailable) return t('plugin.market.actions.update')
  if (props.item.installed) return t('plugin.market.states.installed')
  return t('plugin.market.actions.install')
})
const compatibility = computed(() => ({
  label: t(`plugin.market.compatibility.${props.item.compatibility}`),
  type:
    props.item.compatibility === 'compatible'
      ? ('success' as const)
      : props.item.compatibility === 'incompatible'
        ? ('error' as const)
        : ('default' as const),
}))
</script>

<template>
  <NCard
    class="h-full! border! border-[color-mix(in_srgb,var(--nui-primary-color)_14%,var(--dc-border))]! bg-[color-mix(in_srgb,var(--dc-surface)_96%,var(--nui-primary-color))]!"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2.5">
        <div class="flex min-w-0 items-center gap-2.5">
          <PluginIcon
            :icon="item.installed?.meta.icon ?? item.manifest?.icon"
            :name="displayName"
            :plugin-id="item.installed?.pluginName"
          />
          <div class="grid min-w-0">
            <strong class="dc-ellipsis">{{ displayName }}</strong>
            <span class="dc-ellipsis text-xs text-(--nui-text-color-3)">
              ap:{{ item.listing.id }}
            </span>
          </div>
        </div>
        <NTag size="small" :type="compatibility.type" round>{{ compatibility.label }}</NTag>
      </div>
    </template>

    <p class="m-0 dc-clamp-2 min-h-[3em] text-(--nui-text-color-2)">
      {{ item.manifest?.description ?? t('plugin.market.noDescription') }}
    </p>
    <div
      class="my-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--nui-text-color-3)"
    >
      <span>{{ t('plugin.market.authors', { authors: item.listing.authors.join(', ') }) }}</span>
      <span v-if="version">{{ t('plugin.market.version', { version }) }}</span>
    </div>
    <NTag v-if="item.updateAvailable" size="small" type="info" round>
      {{ t('plugin.market.states.updateAvailable') }}
    </NTag>

    <template #action>
      <div class="flex items-center justify-between gap-2.5">
        <NButton secondary @click="emit('details')">
          {{ t('plugin.market.actions.details') }}
        </NButton>
        <NButton
          type="primary"
          :disabled="actionDisabled"
          :loading="installing"
          @click="emit('install')"
        >
          {{ actionLabel }}
        </NButton>
      </div>
    </template>
  </NCard>
</template>