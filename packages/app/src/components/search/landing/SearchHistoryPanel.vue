<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ items: readonly string[] }>()
const emit = defineEmits<{ clear: []; select: [value: string] }>()
const { t } = useI18n()
</script>

<template>
  <section class="grid gap-3.5">
    <header class="flex min-h-8 items-center justify-between gap-3">
      <h2 class="m-0 text-xl font-bold text-dc-text">{{ t('search.history.title') }}</h2>
      <NButton
        v-if="items.length > 0"
        text
        size="small"
        :aria-label="t('search.actions.clearHistory')"
        @click="emit('clear')"
      >
        {{ t('search.actions.clearHistory') }}
      </NButton>
    </header>
    <div v-if="items.length > 0" class="flex flex-wrap gap-2.5">
      <button
        v-for="item in items"
        :key="item"
        type="button"
        class="max-w-[min(100%,240px)] dc-interactive dc-ellipsis rounded-[7px] border-0 bg-(--dc-gray-1) px-3.5 py-2 font-[inherit] text-dc-text"
        @click="emit('select', item)"
      >
        {{ item }}
      </button>
    </div>
    <p v-else class="m-0 text-dc-text-tertiary">{{ t('search.history.empty') }}</p>
  </section>
</template>