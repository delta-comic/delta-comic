<script setup lang="ts">
import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NSelect } from 'naive-ui'
import { computed, reactive, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { resolveDestinationId } from '@/features/downloads/destination'
import type { AddDownloadRequest, Destination } from '@/features/downloads/downloaderClient'

import DestinationSelect from './DestinationSelect.vue'

const props = defineProps<{ destinations: readonly Destination[]; disabled?: boolean }>()
const emit = defineEmits<{ submit: [request: AddDownloadRequest] }>()
const show = defineModel<boolean>('show', { required: true })
const { t } = useI18n()

const form = reactive({
  checksumAlgorithm: 'sha256' as 'md5' | 'sha256',
  checksumValue: '',
  destinationId: undefined as string | undefined,
  priority: 5,
  source: '',
  sourceType: 'auto' as 'auto' | 'http' | 'torrent',
})
const torrentFileInput = useTemplateRef<HTMLInputElement>('torrentFileInput')
const torrentBase64 = shallowRef<string>()
const torrentFileName = shallowRef<string>()
const torrentFileError = shallowRef<string>()
const readingTorrentFile = shallowRef(false)
const validationError = computed(() => {
  if (torrentFileError.value && !form.source.trim()) return torrentFileError.value
  return !form.source.trim() && !torrentBase64.value ? t('download.errors.sourceRequired') : ''
})
const sourceTypeOptions = computed(() => [
  { label: t('download.add.sourceTypes.auto'), value: 'auto' },
  { label: t('download.add.sourceTypes.http'), value: 'http' },
  { label: t('download.add.sourceTypes.torrent'), value: 'torrent' },
])
const checksumOptions = [
  { label: 'SHA-256', value: 'sha256' },
  { label: 'MD5', value: 'md5' },
]

watch(
  [show, () => props.destinations],
  ([isShown]) => {
    if (isShown) form.destinationId = resolveDestinationId(props.destinations, form.destinationId)
  },
  { immediate: true },
)

function clearTorrentFile() {
  torrentBase64.value = undefined
  torrentFileName.value = undefined
  torrentFileError.value = undefined
  if (torrentFileInput.value) torrentFileInput.value.value = ''
}

function selectTorrentFile() {
  if (torrentFileInput.value) torrentFileInput.value.value = ''
  torrentFileInput.value?.click()
}

async function handleTorrentFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  clearTorrentFile()
  if (!file) return
  if (!file.name.toLocaleLowerCase().endsWith('.torrent')) {
    torrentFileError.value = t('download.errors.invalidTorrentFile')
    return
  }
  if (file.size > 16 * 1024 * 1024) {
    torrentFileError.value = t('download.errors.torrentFileTooLarge')
    return
  }
  readingTorrentFile.value = true
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('torrent file read failed'))
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(file)
    })
    torrentBase64.value = dataUrl.slice(dataUrl.indexOf(',') + 1)
    torrentFileName.value = file.name
    form.sourceType = 'torrent'
  } catch {
    torrentFileError.value = t('download.errors.torrentFileReadFailed')
  } finally {
    readingTorrentFile.value = false
  }
}

function submit() {
  const source = form.source.trim()
  if (!source && !torrentBase64.value) return
  if (torrentBase64.value) {
    emit('submit', {
      input: {
        destinationId: form.destinationId,
        priority: form.priority,
        source: { input: { base64: torrentBase64.value, type: 'bytes' }, onlyFiles: [] },
        title: torrentFileName.value,
      },
      type: 'torrent',
    })
    return
  }
  const torrent =
    form.sourceType === 'torrent' ||
    (form.sourceType === 'auto' && (source.startsWith('magnet:') || source.endsWith('.torrent')))
  if (torrent) {
    emit('submit', {
      input: {
        destinationId: form.destinationId,
        priority: form.priority,
        source: {
          input: source.startsWith('magnet:')
            ? { type: 'magnet', uri: source }
            : { type: 'url', url: source },
          onlyFiles: [],
        },
      },
      type: 'torrent',
    })
    return
  }
  emit('submit', {
    input: {
      checksum: form.checksumValue.trim()
        ? { algorithm: form.checksumAlgorithm, value: form.checksumValue.trim() }
        : undefined,
      destinationId: form.destinationId,
      priority: form.priority,
      url: source,
    },
    type: 'http',
  })
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    class="w-[min(36rem,calc(100vw-2rem))]!"
    :title="t('download.add.title')"
  >
    <NForm label-placement="top" @submit.prevent="submit">
      <NFormItem :label="t('download.add.sourceType')">
        <NSelect
          v-model:value="form.sourceType"
          :options="sourceTypeOptions"
          @update:value="value => value === 'http' && clearTorrentFile()"
        />
      </NFormItem>
      <div v-if="form.sourceType !== 'http'" class="mb-4">
        <input
          ref="torrentFileInput"
          class="hidden"
          accept=".torrent,application/x-bittorrent"
          type="file"
          @change="handleTorrentFile"
        />
        <div class="flex flex-wrap items-center gap-2">
          <NButton :loading="readingTorrentFile" secondary @click="selectTorrentFile">
            {{ t('download.actions.chooseTorrentFile') }}
          </NButton>
          <span v-if="torrentFileName" class="text-xs text-(--dc-text-secondary)">
            {{ t('download.add.torrentFileSelected', { name: torrentFileName }) }}
          </span>
          <NButton v-if="torrentFileName" size="tiny" quaternary @click="clearTorrentFile">
            {{ t('common.actions.delete') }}
          </NButton>
        </div>
      </div>
      <NFormItem
        :feedback="validationError"
        :label="t('download.add.source')"
        :validation-status="validationError ? 'error' : undefined"
      >
        <NInput
          v-model:value="form.source"
          autofocus
          :placeholder="t('download.add.sourcePlaceholder')"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </NFormItem>
      <DestinationSelect v-model:destination-id="form.destinationId" :destinations :disabled />
      <div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <NFormItem :label="t('download.add.priority')">
          <NInputNumber v-model:value="form.priority" class="w-full" :min="1" :max="10" />
        </NFormItem>
        <NFormItem
          v-if="form.sourceType !== 'torrent'"
          :label="t('download.add.checksumAlgorithm')"
        >
          <NSelect v-model:value="form.checksumAlgorithm" :options="checksumOptions" />
        </NFormItem>
      </div>
      <NFormItem v-if="form.sourceType !== 'torrent'" :label="t('download.add.checksum')">
        <NInput
          v-model:value="form.checksumValue"
          :placeholder="t('download.add.checksumPlaceholder')"
        />
      </NFormItem>
      <div class="flex justify-end gap-2 pt-2">
        <NButton :disabled @click="show = false">{{ t('common.actions.cancel') }}</NButton>
        <NButton
          :disabled="disabled || readingTorrentFile || !!validationError"
          attr-type="submit"
          type="primary"
        >
          {{ t('download.actions.add') }}
        </NButton>
      </div>
    </NForm>
  </NModal>
</template>