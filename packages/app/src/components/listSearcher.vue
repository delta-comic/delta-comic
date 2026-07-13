<script setup lang="ts">
import { usePreventBack } from '@delta-comic/ui'
import { isEmpty, uniq } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { NIcon } from 'naive-ui'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

const filtersHistory = defineModel<string[]>('filtersHistory', { required: true })
const { t } = useI18n()

const isSearching = shallowRef(false)
usePreventBack(isSearching)

const searchText = shallowRef('')

const clearSearch = () => {
  searchText.value = ''
  isSearching.value = false
}

const saveHistory = () => {
  if (!isEmpty(searchText.value)) {
    filtersHistory.value = uniq([searchText.value, ...filtersHistory.value])
  }
}

defineExpose({ isSearching, searchText })
</script>

<template>
  <AnimatePresence>
    <div
      :class="[
        isSearching
          ? 'right-1 w-[calc(100%-8px)]! rounded-lg'
          : isEmpty(searchText)
            ? 'pointer-events-none right-10.25 w-1/2 rounded-full opacity-0!'
            : 'right-10.25 ml-3 w-1/2 rounded-full',
      ]"
      class="absolute z-1000! flex h-9 items-center border border-solid border-gray-400 bg-(--dc-background-2) px-1 text-gray-400 opacity-100 transition-all duration-200"
    >
      <NIcon color="rgb(156 163 175)" size="1.5rem" aria-hidden="true">
        <Icons.material.SearchFilled />
      </NIcon>
      <form action="/" class="h-full w-full" @submit.prevent>
        <input
          v-model="searchText"
          type="search"
          class="h-full w-full border-none bg-transparent font-normal! text-(--dc-text-color)"
          spellcheck="false"
          @focus="isSearching = true"
          @blur="saveHistory"
        />
        <Motion
          :initial="{ opacity: 0 }"
          :animate="{ opacity: !isEmpty(searchText) ? 1 : 0 }"
          :transition="{ type: 'tween', duration: 0.1 }"
        >
          <button
            type="button"
            :aria-label="t('search.actions.clear')"
            class="absolute! top-0 right-2 z-10 flex! h-full items-center border-0 bg-transparent p-0 text-gray-400 transition-[transform,opacity]"
            :disabled="isEmpty(searchText)"
            @click="clearSearch"
          >
            <NIcon size="1.25rem"><Icons.material.CloseRound /></NIcon>
          </button>
        </Motion>
      </form>
    </div>
  </AnimatePresence>

  <AnimatePresence>
    <motion.div
      @click="isSearching = false"
      v-if="isSearching"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 0.5 }"
      class="fixed top-[calc(var(--dc-tabs-line-height)+var(--dc-tabs-padding-bottom)+var(--safe-area-inset-top))] left-0 z-10 h-screen w-screen bg-(--dc-black)"
    >
    </motion.div>
    <motion.div
      :initial="{ height: 0, opacity: 0.3 }"
      :animate="{ height: 'auto', opacity: 1 }"
      :exit="{ height: 0, opacity: 0.3 }"
      v-if="isSearching"
      layout
      :transition="{ duration: 0.1 }"
      class="fixed top-[calc(var(--dc-tabs-line-height)+var(--dc-tabs-padding-bottom)+var(--safe-area-inset-top))] z-10 flex max-h-[60vh] w-full flex-wrap justify-evenly overflow-hidden rounded-b-3xl bg-(--dc-background-2) pt-1 pb-3 transition-all"
    >
      <div class="w-full">
        <template v-if="!isEmpty(filtersHistory)">
          <DcCell
            v-for="filter of filtersHistory"
            :key="filter"
            :title="filter"
            @click="searchText = filter"
            class="dc-haptics-feedback w-full"
          />
        </template>
      </div>
    </motion.div>
  </AnimatePresence>
</template>