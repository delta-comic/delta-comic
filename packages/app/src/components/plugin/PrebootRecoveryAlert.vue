<script setup lang="ts">
import type { PrebootRecovery } from '@delta-comic/plugin'
import { useI18n } from 'vue-i18n'

defineProps<{ recovery: PrebootRecovery }>()
defineEmits<{ dismiss: []; manage: [] }>()
const { t } = useI18n()
</script>

<template>
  <NAlert
    class="preboot-alert fixed top-[max(16px,var(--safe-area-inset-top))] left-1/2 z-2000 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 shadow-(--nui-box-shadow-3)"
    :title="t('plugin.recovery.title')"
    type="error"
    closable
    @close="$emit('dismiss')"
  >
    <p class="my-1">{{ recovery.reason }}</p>
    <p class="my-1">
      {{ t('plugin.recovery.affected', { plugins: recovery.plugins.join(', ') }) }}
    </p>
    <div class="mt-2 flex justify-end">
      <NButton size="small" type="primary" @click="$emit('manage')">
        {{ t('plugin.recovery.manage') }}
      </NButton>
    </div>
  </NAlert>
</template>