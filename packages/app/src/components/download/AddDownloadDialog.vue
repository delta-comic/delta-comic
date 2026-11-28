<script setup lang="ts">
const isDesktop = __DC_APP_TARGET__ === 'desktop'

import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NSelect } from 'naive-ui'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import DestinationSelect from '@/components/download/DestinationSelect.vue'
import { resolveDestinationId } from '@/features/downloads/destination'
import type { EnqueueUrlInput, Destination } from '@/features/downloads/downloaderClient'

const props = defineProps<{ destinations: readonly Destination[]; disabled?: boolean }>()
const emit = defineEmits<{ submit: [request: EnqueueUrlInput] }>()
const show = defineModel<boolean>('show', { required: true })
const { t } = useI18n()

const form = reactive({
  checksumAlgorithm: 'sha256' as 'md5' | 'sha256',
  checksumValue: '',
  destinationId: undefined as string | undefined,
  priority: 5,
  source: '',
})
const validationError = computed(() =>
  form.source.trim() ? '' : t('download.errors.sourceRequired'),
)
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

function submit() {
  const source = form.source.trim()
  if (!source) return
  emit('submit', {
    checksum: form.checksumValue.trim()
      ? { algorithm: form.checksumAlgorithm, value: form.checksumValue.trim() }
      : undefined,
    destinationId: form.destinationId,
    priority: form.priority,
    url: source,
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
      <div :class="isDesktop ? 'grid grid-cols-2 gap-x-3' : 'grid grid-cols-1 gap-x-3'">
        <NFormItem :label="t('download.add.priority')">
          <NInputNumber v-model:value="form.priority" class="w-full" :min="1" :max="10" />
        </NFormItem>
        <NFormItem :label="t('download.add.checksumAlgorithm')">
          <NSelect v-model:value="form.checksumAlgorithm" :options="checksumOptions" />
        </NFormItem>
      </div>
      <NFormItem :label="t('download.add.checksum')">
        <NInput
          v-model:value="form.checksumValue"
          :placeholder="t('download.add.checksumPlaceholder')"
        />
      </NFormItem>
      <div class="flex justify-end gap-2 pt-2">
        <NButton :disabled @click="show = false">{{ t('common.actions.cancel') }}</NButton>
        <NButton :disabled="disabled || !!validationError" attr-type="submit" type="primary">
          {{ t('download.actions.add') }}
        </NButton>
      </div>
    </NForm>
  </NModal>
</template>