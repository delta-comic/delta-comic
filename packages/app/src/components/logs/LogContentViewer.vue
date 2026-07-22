<script setup lang="ts">
import { NEmpty, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  content: string
  filtered: boolean
  loading: boolean
  selected: boolean
  truncated: boolean
}>()
const { t } = useI18n()
</script>

<template>
  <section
    :aria-label="t('settings.logs.content.title')"
    class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-(--dc-page)"
  >
    <div
      v-if="truncated"
      class="shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
      role="status"
    >
      {{ t('settings.logs.content.truncated') }}
    </div>
    <NSpin :show="loading" class="min-h-0! flex-1" content-class="h-full min-h-0">
      <div v-if="content" class="size-full overflow-auto overscroll-contain p-3 sm:p-4">
        <pre
          class="m-0 min-w-max cursor-text font-mono text-xs leading-5 break-words whitespace-pre-wrap text-(--dc-text) select-text"
          >{{ content }}</pre
        >
      </div>
      <div v-else class="flex size-full min-h-48 items-center justify-center p-6">
        <NEmpty
          :description="
            t(
              selected
                ? filtered
                  ? 'settings.logs.content.noMatches'
                  : 'settings.logs.content.empty'
                : 'settings.logs.content.selectFile',
            )
          "
        />
      </div>
    </NSpin>
  </section>
</template>