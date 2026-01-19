<script setup lang='ts'>
import { fromPairs, isEmpty } from 'es-toolkit/compat'
import { shallowRef, computed, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import noneSearchTextIcon from '@/assets/images/none-search-text-icon.webp'
import { CloudServerOutlined } from '@vicons/antd'
import { Comp, PluginConfigSearchMethod, Store } from 'delta-comic-core'
import { usePluginStore } from '@/plugin/store'
import List from './list.vue'
import { SearchInstance } from 'vant'
import { decodeURIDeep } from '@/utils/url'
import SearchBar from './searchBar.vue'
import { searchSourceKey } from './source'
const $route = useRoute()
const pluginStore = usePluginStore()
const config = Store.useConfig().$load(Store.appConfig)
const inputSort = $route.query.sort?.toString()
const inputSource = $route.query.source?.toString()

const temp = Store.useTemp().$apply('searchBase', () => {
  const [plugin, [source]] = pluginStore.allSearchSource[0]
  return {
    source: searchSourceKey.toString([plugin, source[0]]),
    sort: inputSort ?? source[1].defaultSort
  }
})
if (inputSource) temp.source = inputSource
watch(() => temp.source, source => {
  const [plugin, name] = searchSourceKey.toJSON(source)
  const s = fromPairs(fromPairs(pluginStore.allSearchSource)[plugin])[name]
  console.log(pluginStore.allSearchSource, (fromPairs(pluginStore.allSearchSource)[plugin]))
  temp.sort = s.defaultSort
}, { immediate: true })
const showSearch = shallowRef(true)
const searchText = shallowRef(decodeURIDeep($route.params.input?.toString() ?? ''))

const method = computed(() => {
  const [plugin, name] = searchSourceKey.toJSON(temp.source)
  return [plugin, fromPairs(fromPairs(pluginStore.allSearchSource)[plugin])[name]] as [plugin: string, method: PluginConfigSearchMethod]
})
const search = useTemplateRef<SearchInstance>('search')
const goSearch = () => {
  showSearch.value = true
  search.value?.focus()
}

</script>

<template>
  <div class="w-full pt-safe bg-(--van-background-2) fixed top-0 z-1"></div>
  <header class="w-full h-[86px] text-(--van-text-color) duration-200 transition-transform mt-safe"
    :class="[showSearch ? '!translate-y-0' : '!-translate-y-[54px]']">
    <SearchBar v-model:search-text="searchText" :source="temp.source" />
    <div class="van-hairline--bottom h-8 w-full relative bg-(--van-background-2)">
      <div class="w-full items-center flex *:!text-nowrap overflow-x-auto scroll gap-2 pr-2">
        <NPopselect :options="pluginStore.allSearchSource.map(([plugin, sources]) => ({
          type: 'group',
          label: pluginStore.$getPluginDisplayName(plugin),
          children: sources.map(([id, { name }]) => ({
            label: name,
            value: searchSourceKey.toString([plugin, id])
          }))
        }))" v-model:value="temp.source" placement="bottom" size="large">
          <NButton quaternary>
            搜索源:<span class="text-(--nui-primary-color) text-xs">
              {{ pluginStore.$getPluginDisplayName(searchSourceKey.toJSON(temp.source)[0]) }}:{{ method[1].name }}
            </span>
            <template #icon>
              <NIcon size="1.8rem">
                <CloudServerOutlined />
              </NIcon>
            </template>
          </NButton>
        </NPopselect>
        <VanPopover :actions="method[1].sorts" @select="q => temp.sort = q.value" placement="bottom-start">
          <template #reference>
            <NButton quaternary class="text-sm h-full van-haptics-feedback flex justify-start items-center">
              <template #icon>
                <VanIcon name="sort" size="1.5rem" class="sort-icon" />
              </template>排序
              <span class="text-(--nui-primary-color) text-xs">
                -{{method[1].sorts.find(v => v.value == temp.sort)?.text ?? 'not found'}}
              </span>
            </NButton>
          </template>
        </VanPopover>
        <div class="text-sm h-full van-haptics-feedback flex justify-start items-center">
          <VanSwitch v-model="config.showAIProject" size="1rem" />展示AI作品
        </div>
      </div>
      <VanIcon @click="goSearch" :class="[showSearch ? 'translate-x-full' : '-translate-x-2']" size="25px"
        class="!absolute top-1/2 duration-200 transition-transform right-0 -translate-y-1/2 bg-(--van-background-2) shadow rounded-full p-1"
        name="search" color="var(--van-text-color-2)" />
    </div>
  </header>

  <NResult status="info" title="无搜索" class="h-[80vh] flex items-center flex-col justify-center" description="请输入"
    v-if="isEmpty($route.params.input)">
    <template #icon>
      <Comp.Image :src="noneSearchTextIcon" />
    </template>
  </NResult>
  <div class="duration-200 *:!h-full transition-all will-change-[height,_transform]" v-else
    :class="[showSearch ? 'h-[calc(100vh-var(--van-tabs-line-height)-var(--van-tabs-padding-bottom)-var(--safe-area-inset-top))] translate-y-0' : 'h-[calc(100vh-32px-var(--safe-area-inset-top))] -translate-y-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom))]']">
    <List v-model:show-header="showSearch" :source="temp.source" :sort="temp.sort" :input="searchText" />
  </div>
</template>
<style scoped lang='css'>
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