<script setup lang="ts">
import HotSearchPanel from '@delta-comic/core/components/search/landing/HotSearchPanel.vue'
import SearchHistoryPanel from '@delta-comic/core/components/search/landing/SearchHistoryPanel.vue'
import SearchLandingForm from '@delta-comic/core/components/search/landing/SearchLandingForm.vue'
import { useSearchLanding } from '@delta-comic/core/features/search/useSearchLanding'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
const {
  clearHistory,
  history,
  hotSearchSections,
  isLoadingHotSearch,
  query,
  selectHotSearchItem,
  submit,
} = useSearchLanding({ onMissingTarget: () => window.$message.error(t('search.errors.noSource')) })
</script>

<template>
  <div class="h-full overflow-y-auto bg-dc-page">
    <SearchLandingForm v-model="query" @back="router.back()" @submit="submit()" />
    <main class="mx-auto grid w-[min(100%,960px)] gap-8 px-(--dc-content-padding) pt-6 pb-12">
      <HotSearchPanel
        :loading="isLoadingHotSearch"
        :sections="hotSearchSections"
        @select="selectHotSearchItem"
      />
      <SearchHistoryPanel :items="history" @clear="clearHistory" @select="value => submit(value)" />
    </main>
  </div>
</template>