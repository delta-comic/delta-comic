<script setup lang="ts">
import { useNativeStore } from '@delta-comic/db'
import { usePreventBack } from '@delta-comic/ui'
import { SharedFunction } from '@delta-comic/utils'
import { ReuseableAbortController } from '@delta-comic/utils'
import { computedAsync } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { NIcon } from 'naive-ui'
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'
import { pluginName } from '@/symbol'
import { getBarcodeList, type ThinkList } from '@/utils/search'

const isSearching = defineModel<boolean>('isSearching', { default: false })
const { t } = useI18n()
usePreventBack(isSearching)

const text = defineModel<string>('text', { default: '' })

const handleSearch = (text: string) => {
  history.value = uniq([text, ...history.value])
  return SharedFunction.call('routeToSearch', text)
}

const inputEl = useTemplateRef('inputEl')

defineExpose({ inputEl, isSearching })

const clearSearch = () => {
  text.value = ''
  isSearching.value = false
}

const history = useNativeStore(pluginName, 'search.history', new Array<string>())
const thinkListAbort = new ReuseableAbortController()
const thinkList = computedAsync<ThinkList>(async onCancel => {
  onCancel(() => thinkListAbort.abort())
  const st = text.value
  const his = history.value.filter(v => v.includes(st)).map(v => ({ text: v, value: v }))
  try {
    const barcodeList = await getBarcodeList(st, thinkListAbort.signal)
    console.log('[thinkList] barcode', barcodeList)
    return [...barcodeList, ...his]
  } catch {
    return his
  }
}, [])
</script>

<template>
  <div class="ml-3 h-9 w-1/2">
    <div
      :class="[
        isSearching ? 'left-1 w-[calc(100%-18px)] rounded-lg' : 'left-10.25 ml-3 rounded-full',
      ]"
      class="absolute z-1000! flex h-9 items-center border border-solid border-gray-400 px-1 text-gray-400 transition-all duration-200"
    >
      <button
        type="button"
        class="inline-flex items-center border-0 bg-transparent p-0 text-gray-400"
        :aria-label="t('search.actions.search')"
        @click="handleSearch(text)"
      >
        <NIcon size="1.5rem"><Icons.material.SearchFilled /></NIcon>
      </button>
      <form action="/" @submit.prevent="handleSearch(text)" class="h-full w-full">
        <input
          ref="inputEl"
          v-model="text"
          type="search"
          class="h-full w-full border-none bg-transparent text-(--dc-text-color)!"
          spellcheck="false"
          @focus="isSearching = true"
          :placeholder="t('search.placeholder.short')"
        />
        <Motion
          :initial="{ opacity: 0 }"
          :animate="{ opacity: !isEmpty(text) ? 1 : 0 }"
          :transition="{ type: 'tween', duration: 0.1 }"
        >
          <button
            type="button"
            :aria-label="t('search.actions.clear')"
            class="absolute! top-0 right-2 z-10 flex! h-full items-center border-0 bg-transparent p-0 text-gray-400 transition-[transform,opacity]"
            :disabled="isEmpty(text)"
            @click="clearSearch"
          >
            <NIcon size="1.25rem"><Icons.material.CloseRound /></NIcon>
          </button>
        </Motion>
      </form>
    </div>
  </div>

  <AnimatePresence>
    <motion.div
      @click="isSearching = false"
      v-if="isSearching"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 0.5 }"
      class="fixed top-safe-offset-[54px] left-0 z-10 h-screen w-screen bg-(--dc-black)"
    >
    </motion.div>
    <motion.div
      :initial="{ height: 0, opacity: 0.3 }"
      :animate="{ height: 'auto', opacity: 1 }"
      :exit="{ height: 0, opacity: 0.3 }"
      v-if="isSearching"
      layout
      :transition="{ duration: 0.1 }"
      class="fixed top-safe-offset-[54px] z-10 flex max-h-[60vh] w-full flex-wrap justify-evenly overflow-hidden rounded-b-3xl bg-(--dc-background-2) pt-1 pb-3 transition-all"
    >
      <DcCellGroup class="w-full">
        <template v-if="!isEmpty(thinkList)">
          <template
            v-for="(think, index) of thinkList"
            :key="'text' in think ? `${think.value}:${index}` : index"
          >
            <DcCell
              v-if="'text' in think"
              :title="think.text"
              @click="handleSearch((text = think.value))"
              class="dc-haptics-feedback w-full"
            />
            <component v-else :is="think" />
          </template>
        </template>
      </DcCellGroup>
    </motion.div>
  </AnimatePresence>
</template>