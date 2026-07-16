<script setup lang="ts">
import type { Search } from '@delta-comic/plugin'
import { useI18n } from 'vue-i18n'

import type { ResolvedHotSearchSection } from '@/features/search/useSearchLanding'

defineProps<{ loading: boolean; sections: readonly ResolvedHotSearchSection[] }>()
const emit = defineEmits<{
  select: [section: ResolvedHotSearchSection, item: Search.HotSearchItem]
}>()
const { t } = useI18n()
</script>

<template>
  <section class="grid gap-6" :aria-busy="loading">
    <div
      v-if="loading && sections.length === 0"
      class="grid grid-cols-2 gap-x-3.5 gap-y-2 min-[720px]:grid-cols-3"
    >
      <NSkeleton v-for="index in 6" :key="index" height="44px" :sharp="false" />
    </div>
    <NEmpty
      v-else-if="sections.length === 0"
      class="pt-9 pb-3"
      :description="t('search.hot.empty')"
    />
    <template v-else>
      <section v-for="section in sections" :key="section.id" class="grid gap-2.5">
        <h2 class="m-0 text-xl font-bold text-dc-text">{{ section.title }}</h2>
        <div class="grid grid-cols-2 gap-x-3.5 gap-y-2 min-[720px]:grid-cols-3">
          <button
            v-for="item in section.items"
            :key="`${item.value ?? item.text}:${item.text}`"
            type="button"
            class="flex h-11 min-w-0 dc-interactive items-center gap-2 border-0 bg-transparent px-1 text-left font-[inherit] text-base text-dc-text"
            @click="emit('select', section, item)"
          >
            <span class="dc-ellipsis">{{ item.text }}</span>
            <span
              v-if="item.badge"
              class="shrink-0 rounded-[5px] px-[5px] py-px text-[11px] text-white"
              :class="item.badge.tone === 'warning' ? 'bg-[#f0a020]' : 'bg-dc-primary'"
            >
              {{ item.badge.text }}
            </span>
          </button>
        </div>
      </section>
    </template>
  </section>
</template>