<script setup lang="ts">
import { NButton, NIcon, NInput } from 'naive-ui'
import { onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

const query = defineModel<string>({ required: true })
const emit = defineEmits<{ back: []; submit: [] }>()
const { t } = useI18n()
const input = useTemplateRef<InstanceType<typeof NInput>>('input')

onMounted(() => input.value?.focus())
</script>

<template>
  <form
    class="sticky top-0 z-10 grid min-h-[calc(var(--dc-page-header-height)+var(--safe-area-inset-top))] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 border-b border-dc-border bg-[color-mix(in_srgb,var(--dc-surface)_94%,transparent)] [padding:var(--safe-area-inset-top)_12px_0] backdrop-blur-2xl"
    action="/"
    @submit.prevent="emit('submit')"
  >
    <NButton
      class="text-4xl! leading-none!"
      text
      circle
      attr-type="button"
      :aria-label="t('common.actions.back')"
      @click="emit('back')"
    >
      <span aria-hidden="true">‹</span>
    </NButton>
    <NInput
      ref="input"
      v-model:value="query"
      class="min-w-0"
      round
      clearable
      :placeholder="t('search.placeholder.full')"
      :input-props="{ autocomplete: 'off', enterkeyhint: 'search', spellcheck: false }"
    >
      <template #prefix>
        <NIcon size="1.35rem"><Icons.material.SearchFilled /></NIcon>
      </template>
    </NInput>
    <NButton class="text-base!" text type="primary" attr-type="submit">
      {{ t('search.actions.search') }}
    </NButton>
  </form>
</template>