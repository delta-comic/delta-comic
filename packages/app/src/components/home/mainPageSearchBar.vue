<script setup lang="ts">
import { pluginName } from '@/symbol'
import { getBarcodeList, type ThinkList } from '@/utils/search'
import { SharedFunction } from '@delta-comic/core'
import { useNativeStore } from '@delta-comic/db'
import { SmartAbortController } from '@delta-comic/request'
import { useZIndex } from '@delta-comic/ui'
import { computedAsync } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { useTemplateRef } from 'vue'

const isSearching = defineModel<boolean>('isSearching', { default: false })
const text = defineModel<string>('text', { default: '' })

const handleSearch = (text: string) => {
  history.value = uniq([text, ...history.value])
  return SharedFunction.call('routeToSearch', text)
}

const inputEl = useTemplateRef('inputEl')

defineExpose({ inputEl, isSearching })

const [zIndex] = useZIndex(isSearching)

const history = useNativeStore(pluginName, 'search.history', new Array<string>())
const thinkListAbort = new SmartAbortController()
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
    <div :class="[
      isSearching ? 'left-1 w-[calc(100%-18px)] rounded-lg' : 'left-10.25 ml-3 w-1/2 rounded-full'
    ]"
      class="absolute z-1000! flex h-9 items-center border border-solid border-gray-400 px-1 text-gray-400 transition-all duration-200">
      <VanIcon name="search" color="rgb(156 163 175)" size="1.5rem" @click="handleSearch(text)" />
      <form action="/" @submit.prevent="handleSearch(text)" class="h-full w-full">
        <input type="search" class="h-full w-full border-none bg-transparent text-(--van-text-color)!"
          spellcheck="false" @focus="isSearching = true" v-model="text" placeholder="搜索" ref="inputEl" />
        <Motion :initial="{ opacity: 0 }" :animate="{ opacity: !isEmpty(text) ? 1 : 0 }"
          :transition="{ type: 'tween', duration: 0.1 }">
          <VanIcon name="cross" @click="
            () => {
              text = ''
              isSearching = false
            }
          " class="absolute! top-0 right-2 z-10 flex! h-full items-center font-bold transition-[transform,opacity]"
            color="#9ca3af" />
        </Motion>
      </form>
    </div>
  </div>

  <Teleport to="#popups">
    <AnimatePresence>
      <motion.div @click="isSearching = false" v-if="isSearching" :style="{ zIndex }" :initial="{ opacity: 0 }"
        :animate="{ opacity: 0.5 }" class="fixed top-safe-offset-[54px] left-0 h-screen w-screen bg-(--van-black)">
      </motion.div>
      <motion.div :style="{ zIndex }" :initial="{ height: 0, opacity: 0.3 }" :animate="{ height: 'auto', opacity: 1 }"
        :exit="{ height: 0, opacity: 0.3 }" v-if="isSearching" layout :transition="{ duration: 0.1 }"
        class="fixed top-safe-offset-[54px] flex max-h-[60vh] w-full flex-wrap justify-evenly overflow-hidden rounded-b-3xl bg-(--van-background-2) pt-1 pb-3 transition-all">
        <VanCellGroup class="w-full">
          <template v-if="!isEmpty(thinkList)">
            <template v-for="think of thinkList">
              <VanCell v-if="'text' in think" :title="think.text" @click="handleSearch((text = think.value))"
                class="van-haptics-feedback w-full" />
              <component v-else :is="think" />
            </template>
          </template>
        </VanCellGroup>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>