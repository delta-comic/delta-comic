<script setup lang='ts'>
import { Utils } from 'delta-comic-core'
import { isEmpty, uniq } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { shallowRef } from 'vue'

const filtersHistory = defineModel<string[]>('filtersHistory', { required: true })

const isSearching = shallowRef(false)
const searchText = shallowRef('')
const [zIndex] = Utils.layout.useZIndex(isSearching)

defineExpose({
  isSearching,
  searchText
})
</script>

<template>
  <AnimatePresence>
    <div :class="[isSearching ? 'rounded-lg w-[calc(100%-8px)] right-1 ' : isEmpty(searchText)
      ? 'rounded-full w-1/2 right-[41px] !opacity-0 pointer-events-none' : 'rounded-full w-1/2 ml-3 right-[41px]']"
      class="transition-all duration-200 border-solid border bg-(--van-background-2) opacity-100 absolute !z-1000 border-gray-400 text-gray-400 h-[36px] px-1 flex items-center">
      <VanIcon name="search" color="rgb(156 163 175)" size="1.5rem" />
      <SearchTag :text="searchText" />
      <form action="/" @submit.prevent class="h-full w-full">
        <input type="search" class="h-full w-full border-none bg-transparent !font-normal text-(--van-text-color)"
          spellcheck="false" @focus="isSearching = true" v-model="searchText" ref="inputEl"
          @blur="isEmpty(searchText) || (filtersHistory = uniq([searchText, ...filtersHistory]))" />
        <Motion :initial="{ opacity: 0 }" :animate="{ opacity: !isEmpty(searchText) ? 1 : 0 }"
          :transition="{ type: 'tween', duration: 0.1 }">
          <VanIcon name="cross" @click="() => { searchText = ''; isSearching = false }"
            class="z-10 !absolute h-full right-2 !flex items-center top-0 font-bold transition-[transform,_opacity]"
            color="#9ca3af" />
        </Motion>
      </form>
    </div>
  </AnimatePresence>

  <Teleport to="#popups">
    <AnimatePresence>
      <motion.div @click="isSearching = false" v-if="isSearching" :style="{ zIndex }" :initial="{ opacity: 0 }"
        :animate="{ opacity: 0.5 }"
        class="bg-(--van-black) w-screen h-screen fixed top-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom)+var(--safe-area-inset-top))] left-0">
      </motion.div>
      <motion.div :style="{ zIndex }" :initial="{ height: 0, opacity: 0.3 }" :animate="{ height: 'auto', opacity: 1 }"
        :exit="{ height: 0, opacity: 0.3 }" v-if="isSearching" layout :transition="{ duration: 0.1 }"
        class="w-full flex flex-wrap max-h-[60vh] justify-evenly transition-all overflow-hidden bg-(--van-background-2) rounded-b-3xl pb-3 pt-1 fixed top-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom)+var(--safe-area-inset-top))]">
        <VanList class="w-full">
          <template v-if="!isEmpty(filtersHistory)">
            <VanCell v-for="filter of filtersHistory" :title="filter" @click="searchText = filter"
              class="van-haptics-feedback w-full" />
          </template>
        </VanList>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>