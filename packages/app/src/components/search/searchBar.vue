<script setup lang="ts">
import { useNativeStore } from '@delta-comic/db'
import { usePluginStore } from '@delta-comic/plugin'
import { usePreventBack } from '@delta-comic/ui'
import { SharedFunction } from '@delta-comic/utils'
import { ReuseableAbortController } from '@delta-comic/utils'
import { computedAsync } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { NButton, NIcon, NInput } from 'naive-ui'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { Icons } from '@/icons'
import { pluginName } from '@/symbol'
import { getBarcodeList, type ThinkList } from '@/utils/search'

import { searchSourceKey } from './source'
const $props = defineProps<{ source: string }>()
const { t } = useI18n()

const isSearching = shallowRef(false)
usePreventBack(isSearching)

const searchText = defineModel<string>('searchText', { required: true })
const source = computed(() => {
  const [plugin, method] = searchSourceKey.toJSON($props.source)
  return { plugin, method }
})

const $router = useRouter()
const history = useNativeStore(pluginName, 'search.history', new Array<string>())
const handleSearch = (text: string) => {
  history.value = uniq([text, ...history.value])
  return SharedFunction.call('routeToSearch', text)
}

const pluginStore = usePluginStore()
const thinkListAbort = new ReuseableAbortController()
const thinkList = computedAsync<ThinkList>(async onCancel => {
  onCancel(() => thinkListAbort.abort())
  const { method, plugin } = source.value
  const st = searchText.value
  if (isEmpty(st)) return history.value.map(v => ({ text: v, value: v }))
  const localSource = pluginStore.plugins.get(plugin)?.search?.methods?.[method]
  try {
    const barcodeList = await getBarcodeList(st, thinkListAbort.signal)
    if (!localSource) return [...barcodeList, ...history.value.map(v => ({ text: v, value: v }))]
    return [...barcodeList, ...(await localSource.getAutoComplete(st, thinkListAbort.signal))]
  } catch {
    return []
  }
}, [])
</script>

<template>
  <form
    action="/"
    :class="[{ 'fixed top-0 left-0 z-1000 w-screen': isSearching }]"
    @submit.prevent="handleSearch(searchText)"
  >
    <div class="flex h-13.5 items-center gap-2 bg-(--dc-background-2) px-3">
      <NInput
        v-model:value="searchText"
        round
        clearable
        :placeholder="t('search.placeholder.full')"
        :input-props="{ autocomplete: 'off' }"
        @focus="isSearching = true"
      >
        <template #prefix>
          <button
            type="button"
            class="inline-flex items-center border-0 bg-transparent p-0 text-inherit"
            :aria-label="t('search.actions.search')"
            @click="handleSearch(searchText)"
          >
            <NIcon size="1.2rem"><Icons.material.SearchFilled /></NIcon>
          </button>
        </template>
      </NInput>
      <NButton text type="primary" attr-type="button" @click="$router.back()">
        {{ t('common.actions.cancel') }}
      </NButton>
    </div>
  </form>

  <AnimatePresence>
    <motion.div
      @click="isSearching = false"
      v-if="isSearching"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 0.5 }"
      :exit="{ opacity: 0 }"
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
              @click="searchText = think.value"
              class="dc-haptics-feedback w-full"
            />
            <component v-else :is="think" />
          </template>
        </template>
      </DcCellGroup>
    </motion.div>
  </AnimatePresence>
</template>