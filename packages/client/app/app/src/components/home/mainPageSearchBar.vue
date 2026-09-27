<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

const emit = defineEmits<{ activate: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="ml-3 h-9 min-w-0 flex-1">
    <button
      type="button"
      class="flex h-full w-full dc-interactive items-center gap-2 rounded-full border border-solid border-gray-400 bg-transparent px-3 text-left text-gray-400"
      :aria-label="t('search.actions.open')"
      @click="emit('activate')"
    >
      <NIcon size="1.5rem"><Icons.material.SearchFilled /></NIcon>
      <span class="dc-ellipsis">{{ t('search.placeholder.short') }}</span>
    </button>
  </div>
</template>