<script setup lang="ts">
import type { PrebootRecovery } from '@delta-comic/plugin'
import { useI18n } from 'vue-i18n'

defineProps<{ recovery: PrebootRecovery }>()
defineEmits<{ dismiss: []; manage: [] }>()
const { t } = useI18n()
</script>

<template>
  <NAlert
    class="preboot-alert"
    :title="t('plugin.recovery.title')"
    type="error"
    closable
    @close="$emit('dismiss')"
  >
    <p class="preboot-alert__message">{{ recovery.reason }}</p>
    <p class="preboot-alert__plugins">
      {{ t('plugin.recovery.affected', { plugins: recovery.plugins.join(', ') }) }}
    </p>
    <div class="preboot-alert__actions">
      <NButton size="small" type="primary" @click="$emit('manage')">
        {{ t('plugin.recovery.manage') }}
      </NButton>
    </div>
  </NAlert>
</template>

<style scoped>
.preboot-alert {
  position: fixed;
  z-index: 2000;
  top: max(16px, var(--safe-area-inset-top));
  left: 50%;
  width: min(560px, calc(100vw - 32px));
  transform: translateX(-50%);
  box-shadow: var(--nui-box-shadow-3);
}

.preboot-alert__message,
.preboot-alert__plugins {
  margin: 4px 0;
}

.preboot-alert__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>