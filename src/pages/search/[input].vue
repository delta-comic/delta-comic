<script setup lang="ts">
import { fromPairs, isEmpty } from 'es-toolkit/compat'
import { shallowRef, computed, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import noneSearchTextIcon from '@/assets/images/none-search-text-icon.webp'
import { CloudServerOutlined } from '@vicons/antd'
import List from '@/components/search/searchList.vue'
import type { SearchInstance } from 'vant'
import { decodeURIDeep } from '@/utils/url'
import SearchBar from '@/components/search/searchBar.vue'
import { searchSourceKey } from '@/components/search/source'
import { appConfig, useConfig, usePluginStore, type Search } from '@delta-comic/plugin'
import { useTemp } from '@delta-comic/core'
const $route = useRoute<'/search/[input]'>()
const pluginStore = usePluginStore()
const config = useConfig().$load(appConfig)
const inputSort = $route.query.sort?.toString()
const inputSource = $route.query.source?.toString()

const temp = useTemp().$apply('searchBase', () => {
  const [plugin, [source]] = pluginStore.allSearchSource[0]
  return {
    source: searchSourceKey.toString([plugin, source[0]]),
    sort: inputSort ?? source[1].defaultSort
  }
})
if (inputSource) temp.source = inputSource
watch(
  () => temp.source,
  source => {
    const [plugin, name] = searchSourceKey.toJSON(source)
    const s = fromPairs(fromPairs(pluginStore.allSearchSource)[plugin])[name]
    console.log(pluginStore.allSearchSource, fromPairs(pluginStore.allSearchSource)[plugin])
    temp.sort = s.defaultSort
  },
  { immediate: true }
)
const showSearch = shallowRef(true)
const searchText = shallowRef(decodeURIDeep($route.params.input?.toString() ?? ''))

const method = computed(() => {
  const [plugin, name] = searchSourceKey.toJSON(temp.source)
  return [plugin, fromPairs(fromPairs(pluginStore.allSearchSource)[plugin])[name]] as [
    plugin: string,
    method: Search.SearchMethod
  ]
})
const search = useTemplateRef<SearchInstance>('search')
const goSearch = () => {
  showSearch.value = true
  search.value?.focus()
}
</script>

<template>
  <div class="fixed top-0 z-1 w-full bg-(--van-background-2) pt-safe"></div>
  <header class="mt-safe h-21.5 w-full text-(--van-text-color) transition-transform duration-200"
    :class="[showSearch ? 'translate-y-0!' : '-translate-y-13.5!']">
    <SearchBar v-model:search-text="searchText" :source="temp.source" />
    <div class="van-hairline--bottom relative h-8 w-full bg-(--van-background-2)">
      <div class="scroll flex w-full items-center gap-2 overflow-x-auto pr-2 *:text-nowrap!">
        <NPopselect :options="pluginStore.allSearchSource.map(([plugin, sources]) => ({
          type: 'group',
          label: pluginStore.$getPluginDisplayName(plugin),
          children: sources.map(([id, { name }]) => ({
            label: name,
            value: searchSourceKey.toString([plugin, id])
          }))
        }))
          " v-model:value="temp.source" placement="bottom" size="large">
          <NButton quaternary>
            搜索源:<span class="text-xs text-(--nui-primary-color)">
              {{ pluginStore.$getPluginDisplayName(searchSourceKey.toJSON(temp.source)[0]) }}:{{
                method[1].name
              }}
            </span>
            <template #icon>
              <NIcon size="1.8rem">
                <CloudServerOutlined />
              </NIcon>
            </template>
          </NButton>
        </NPopselect>
        <VanPopover :actions="method[1].sorts" @select="q => (temp.sort = q.value)" placement="bottom-start">
          <template #reference>
            <NButton quaternary class="van-haptics-feedback flex h-full items-center justify-start text-sm">
              <template #icon>
                <VanIcon name="sort" size="1.5rem" class="sort-icon" />
              </template>排序
              <span class="text-xs text-(--nui-primary-color)">
                -{{method[1].sorts.find(v => v.value == temp.sort)?.text ?? 'not found'}}
              </span>
            </NButton>
          </template>
        </VanPopover>
        <div class="van-haptics-feedback flex h-full items-center justify-start text-sm">
          <VanSwitch v-model="config.showAIProject" size="1rem" />展示AI作品
        </div>
      </div>
      <VanIcon @click="goSearch" :class="[showSearch ? 'translate-x-full' : '-translate-x-2']" size="25px"
        class="absolute! top-1/2 right-0 -translate-y-1/2 rounded-full bg-(--van-background-2) p-1 shadow transition-transform duration-200"
        name="search" color="var(--van-text-color-2)" />
    </div>
  </header>

  <NResult status="info" title="无搜索" class="flex h-[80vh] flex-col items-center justify-center" description="请输入"
    v-if="isEmpty($route.params.input)">
    <template #icon>
      <DcImage :src="noneSearchTextIcon" />
    </template>
  </NResult>
  <div class="transition-all duration-200 will-change-[height,transform] *:h-full!" v-else :class="[
    showSearch
      ? 'h-[calc(100vh-var(--van-tabs-line-height)-var(--van-tabs-padding-bottom)-var(--safe-area-inset-top))] translate-y-0'
      : 'h-[calc(100vh-32px-var(--safe-area-inset-top))] -translate-y-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom))]'
  ]">
    <List v-model:show-header="showSearch" :source="temp.source" :sort="temp.sort" :input="searchText" />
  </div>
</template>
<style scoped lang="css">
:deep(.van-swipe-item) {
  height: 100% !important;
}

:deep(.van-tab__panel) {
  height: 100% !important;
}

.scroll::-webkit-scrollbar {
  display: none;
}
</style>