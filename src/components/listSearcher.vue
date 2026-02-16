<script setup lang="ts">
import { useZIndex } from '@delta-comic/ui'
import { isEmpty, uniq } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { shallowRef } from 'vue'

const filtersHistory = defineModel<string[]>('filtersHistory', { required: true })

const isSearching = shallowRef(false)
const searchText = shallowRef('')
const [zIndex] = useZIndex(isSearching)

defineExpose({ isSearching, searchText })
</script>

<template>
  <AnimatePresence>
    <div
      :class="[
        isSearching
          ? 'right-1 w-[calc(100%-8px)] rounded-lg'
          : isEmpty(searchText)
            ? 'pointer-events-none right-10.25 w-1/2 rounded-full opacity-0!'
            : 'right-10.25 ml-3 w-1/2 rounded-full'
      ]"
      class="absolute z-1000! flex h-9 items-center border border-solid border-gray-400 bg-(--van-background-2) px-1 text-gray-400 opacity-100 transition-all duration-200"
    >
      <VanIcon name="search" color="rgb(156 163 175)" size="1.5rem" />
      <form action="/" @submit.prevent class="h-full w-full">
        <input
          type="search"
          class="h-full w-full border-none bg-transparent font-normal! text-(--van-text-color)"
          spellcheck="false"
          @focus="isSearching = true"
          v-model="searchText"
          ref="inputEl"
          @blur="isEmpty(searchText) || (filtersHistory = uniq([searchText, ...filtersHistory]))"
        />
        <Motion
          :initial="{ opacity: 0 }"
          :animate="{ opacity: !isEmpty(searchText) ? 1 : 0 }"
          :transition="{ type: 'tween', duration: 0.1 }"
        >
          <VanIcon
            name="cross"
            @click="
              () => {
                searchText = ''
                isSearching = false
              }
            "
            class="absolute! top-0 right-2 z-10 flex! h-full items-center font-bold transition-[transform,opacity]"
            color="#9ca3af"
          />
        </Motion>
      </form>
    </div>
  </AnimatePresence>

  <Teleport to="#popups">
    <AnimatePresence>
      <motion.div
        @click="isSearching = false"
        v-if="isSearching"
        :style="{ zIndex }"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 0.5 }"
        class="fixed top-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom)+var(--safe-area-inset-top))] left-0 h-screen w-screen bg-(--van-black)"
      >
      </motion.div>
      <motion.div
        :style="{ zIndex }"
        :initial="{ height: 0, opacity: 0.3 }"
        :animate="{ height: 'auto', opacity: 1 }"
        :exit="{ height: 0, opacity: 0.3 }"
        v-if="isSearching"
        layout
        :transition="{ duration: 0.1 }"
        class="fixed top-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom)+var(--safe-area-inset-top))] flex max-h-[60vh] w-full flex-wrap justify-evenly overflow-hidden rounded-b-3xl bg-(--van-background-2) pt-1 pb-3 transition-all"
      >
        <VanList class="w-full">
          <template v-if="!isEmpty(filtersHistory)">
            <VanCell
              v-for="filter of filtersHistory"
              :title="filter"
              @click="searchText = filter"
              class="van-haptics-feedback w-full"
            />
          </template>
        </VanList>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>