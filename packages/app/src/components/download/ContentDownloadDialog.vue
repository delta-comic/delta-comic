<script setup lang="ts">
import { type uni } from '@delta-comic/model'
import {
  NAlert,
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NEmpty,
  NModal,
  NRadio,
  NRadioGroup,
  NSpin,
} from 'naive-ui'
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { resolveDestinationId, type ContentDownloadRequest } from '@/features/downloads/destination'
import type { Destination } from '@/features/downloads/downloaderClient'
import { loadContentEpisodes } from '@/features/downloads/loadContentEpisodes'

import DestinationSelect from './DestinationSelect.vue'

type SelectionMode = 'allEpisodes' | 'currentEpisode' | 'episodes'

const props = defineProps<{
  destinations: readonly Destination[]
  disabled?: boolean
  page: uni.content.ContentPage
}>()
const emit = defineEmits<{ submit: [request: ContentDownloadRequest] }>()
const show = defineModel<boolean>('show', { required: true })
const { t } = useI18n()

const mode = shallowRef<SelectionMode>('currentEpisode')
const destinationId = shallowRef<string>()
const episodes = shallowRef<uni.ep.Ep[]>([])
const selectedEpisodeIds = shallowRef<string[]>([])
const loading = shallowRef(false)
const loadError = shallowRef<string>()
let loadController: AbortController | undefined

const selectionError = computed(() =>
  mode.value === 'episodes' && selectedEpisodeIds.value.length === 0
    ? t('download.content.selectionRequired')
    : undefined,
)

async function loadEpisodes() {
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  loading.value = true
  loadError.value = undefined
  try {
    episodes.value = await loadContentEpisodes(props.page, controller.signal)
  } catch (error) {
    if (controller.signal.aborted) return
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (loadController === controller) loading.value = false
  }
}

function submit() {
  if (selectionError.value) return
  if (mode.value === 'episodes') {
    emit('submit', {
      destinationId: destinationId.value,
      selection: { episodeIds: [...selectedEpisodeIds.value], type: 'episodes' },
    })
    return
  }
  emit('submit', { destinationId: destinationId.value, selection: { type: mode.value } })
}

watch(
  [show, mode],
  ([isShown, selectedMode]) => {
    if (!isShown) {
      loadController?.abort()
      return
    }
    if (selectedMode === 'episodes' && episodes.value.length === 0) void loadEpisodes()
  },
  { immediate: true },
)

watch(
  [show, () => props.destinations],
  ([isShown]) => {
    if (isShown) destinationId.value = resolveDestinationId(props.destinations, destinationId.value)
  },
  { immediate: true },
)

onUnmounted(() => loadController?.abort())
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    class="w-[min(38rem,calc(100vw-2rem))]!"
    :title="t('download.content.title')"
  >
    <NRadioGroup v-model:value="mode" class="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
      <NRadio value="currentEpisode">{{ t('download.content.options.current') }}</NRadio>
      <NRadio value="episodes">{{ t('download.content.options.selected') }}</NRadio>
      <NRadio value="allEpisodes">{{ t('download.content.options.all') }}</NRadio>
    </NRadioGroup>

    <div class="mt-5">
      <DestinationSelect v-model:destination-id="destinationId" :destinations :disabled />
    </div>

    <section v-if="mode === 'episodes'" class="mt-5">
      <h3 class="mb-2 text-sm font-semibold text-(--dc-text)">
        {{ t('download.content.selectEpisodes') }}
      </h3>
      <NAlert v-if="loadError" class="mb-3" type="error">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ t('download.content.loadFailed', { error: loadError }) }}</span>
          <NButton size="small" @click="loadEpisodes">{{ t('download.actions.retry') }}</NButton>
        </div>
      </NAlert>
      <NSpin :description="t('download.content.loadingEpisodes')" :show="loading">
        <div
          class="max-h-[45vh] min-h-28 overflow-y-auto rounded-lg border border-(--dc-border) p-3"
        >
          <NCheckboxGroup v-if="episodes.length" v-model:value="selectedEpisodeIds">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <NCheckbox v-for="episode in episodes" :key="episode.id" :value="episode.id">
                <span class="break-words">{{ episode.name }}</span>
              </NCheckbox>
            </div>
          </NCheckboxGroup>
          <NEmpty
            v-else-if="!loading && !loadError"
            :description="t('download.content.emptyEpisodes')"
          />
        </div>
      </NSpin>
      <p v-if="selectionError" class="mt-2 text-xs text-red-600 dark:text-red-300">
        {{ selectionError }}
      </p>
    </section>

    <div class="mt-6 flex justify-end gap-2">
      <NButton :disabled @click="show = false">{{ t('common.actions.cancel') }}</NButton>
      <NButton
        :disabled="disabled || loading || !!loadError || !!selectionError"
        type="primary"
        @click="submit"
      >
        {{ t('download.actions.add') }}
      </NButton>
    </div>
  </NModal>
</template>