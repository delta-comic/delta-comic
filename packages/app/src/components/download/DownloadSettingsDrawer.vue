<script setup lang="ts">
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NFormItem,
  NInputNumber,
  NSlider,
  NSwitch,
  NTag,
} from 'naive-ui'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  Destination,
  DownloaderCapabilities,
  DownloaderSettings,
} from '@/features/downloads/downloaderClient'

const props = defineProps<{
  capabilities: DownloaderCapabilities
  destinations: readonly Destination[]
  disabled?: boolean
  settings: DownloaderSettings
}>()
const emit = defineEmits<{ pickDestination: []; save: [settings: Partial<DownloaderSettings>] }>()
const show = defineModel<boolean>('show', { required: true })
const { t } = useI18n()
const defaultDestination = computed(() =>
  props.destinations.find(destination => destination.isDefault),
)

const form = reactive({
  allowMetered: true,
  connectionBudget: 16,
  maxActiveTasks: 4,
  perTaskConnections: 8,
  seedMinutes: undefined as number | undefined,
  seedOnComplete: false,
  seedRatio: undefined as number | undefined,
})

watch(
  [() => props.settings, () => props.capabilities.connectionBudgetMax] as const,
  ([settings, connectionBudgetMax]) => {
    form.allowMetered = settings.allowMetered
    form.connectionBudget = Math.min(settings.connectionBudget, connectionBudgetMax)
    form.maxActiveTasks = settings.maxActiveTasks
    form.perTaskConnections = settings.perTaskConnections
    form.seedOnComplete = settings.seedOnComplete
    form.seedRatio = settings.seedRatio ?? undefined
    form.seedMinutes =
      settings.seedSeconds == null ? undefined : Math.round(settings.seedSeconds / 60)
  },
  { immediate: true },
)

function save() {
  const connectionBudget = Math.min(form.connectionBudget, props.capabilities.connectionBudgetMax)
  emit('save', {
    allowMetered: form.allowMetered,
    connectionBudget,
    maxActiveTasks: form.maxActiveTasks,
    perTaskConnections: Math.min(form.perTaskConnections, connectionBudget),
    seedOnComplete: form.seedOnComplete,
    seedRatio: form.seedOnComplete ? form.seedRatio : undefined,
    seedSeconds:
      form.seedOnComplete && form.seedMinutes != null
        ? Math.round(form.seedMinutes * 60)
        : undefined,
  })
}
</script>

<template>
  <NDrawer
    v-model:show="show"
    class="bg-(--dc-background)!"
    placement="right"
    width="min(30rem, 100vw)"
  >
    <NDrawerContent closable :title="t('download.settings.title')">
      <div class="space-y-6">
        <section aria-labelledby="download-destinations-heading" class="space-y-3">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 id="download-destinations-heading" class="text-sm font-semibold text-(--dc-text)">
                {{ t('download.destinations.title') }}
              </h3>
              <NButton :disabled secondary size="small" @click="emit('pickDestination')">
                {{ t('download.destinations.add') }}
              </NButton>
            </div>
          </div>

          <dl class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 text-sm">
            <dt class="text-(--dc-text-secondary)">
              {{ t('download.destinations.defaultDestination') }}
            </dt>
            <dd class="min-w-0 text-right font-medium break-words text-(--dc-text)">
              {{ defaultDestination?.label ?? t('download.destinations.none') }}
            </dd>
          </dl>

          <ul
            v-if="destinations.length"
            :aria-label="t('download.destinations.registered')"
            class="divide-y divide-(--dc-border) border-y border-(--dc-border)"
          >
            <li v-for="destination in destinations" :key="destination.id" class="py-3">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="min-w-0 font-medium break-words text-(--dc-text)">
                  {{ destination.label }}
                </span>
                <NTag v-if="destination.isDefault" :bordered="false" size="small" type="success">
                  {{ t('download.destinations.default') }}
                </NTag>
              </div>
              <p class="mt-1 text-xs break-all text-(--dc-text-secondary)">
                {{ t(`download.destinations.kinds.${destination.kind}`) }}
              </p>
            </li>
          </ul>
          <NEmpty v-else :description="t('download.destinations.none')" size="small" />
        </section>

        <NFormItem :label="t('download.settings.concurrentTasks')">
          <div class="flex w-full items-center gap-3">
            <NSlider v-model:value="form.maxActiveTasks" :min="1" :max="20" :step="1" />
            <NInputNumber v-model:value="form.maxActiveTasks" class="w-24" :min="1" :max="20" />
          </div>
        </NFormItem>
        <NFormItem :label="t('download.settings.connections')">
          <NInputNumber
            v-model:value="form.connectionBudget"
            class="w-full"
            :min="1"
            :max="capabilities.connectionBudgetMax"
          />
        </NFormItem>
        <NFormItem :label="t('download.settings.connectionsPerTask')">
          <NInputNumber
            v-model:value="form.perTaskConnections"
            class="w-full"
            :min="1"
            :max="form.connectionBudget"
          />
        </NFormItem>
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-sm font-medium text-(--dc-text)">
              {{ t('download.settings.allowMetered') }}
            </div>
            <div class="mt-1 text-xs text-(--dc-text-secondary)">
              {{ t('download.settings.allowMeteredDescription') }}
            </div>
          </div>
          <NSwitch v-model:value="form.allowMetered" />
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm font-medium text-(--dc-text)">{{
            t('download.settings.seedEnabled')
          }}</span>
          <NSwitch v-model:value="form.seedOnComplete" />
        </div>
        <template v-if="form.seedOnComplete">
          <NFormItem :label="t('download.settings.seedRatio')">
            <NInputNumber
              v-model:value="form.seedRatio"
              class="w-full"
              :min="0.1"
              :step="0.1"
              clearable
            />
          </NFormItem>
          <NFormItem :label="t('download.settings.seedMinutes')">
            <NInputNumber v-model:value="form.seedMinutes" class="w-full" :min="1" clearable />
          </NFormItem>
        </template>
      </div>
      <template #footer>
        <NButton :loading="disabled" type="primary" @click="save">{{
          t('common.actions.confirm')
        }}</NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>