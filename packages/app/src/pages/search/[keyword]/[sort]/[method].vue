<script setup lang="ts">
import { SharedFunction } from '@delta-comic/core'
import { uni } from '@delta-comic/model'
import { appConfig, useConfig, usePluginStore } from '@delta-comic/plugin'
import { useInfiniteQuery } from '@pinia/colada'
import { isEmpty } from 'es-toolkit/compat'
import { computed, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import noneSearchTextIcon from '@/assets/images/none-search-text-icon.webp'
import { searchSourceKey } from '@/components/search/source'
import { Icons } from '@/icons'

const route = useRoute<'/search/[keyword]/[sort]/[method]'>()
const pluginStore = usePluginStore()
const config = useConfig().$load(appConfig)

const method = computed(() => {
  const [plugin, name] = searchSourceKey.toJSON(route.params.method)
  return Object.fromEntries(Object.fromEntries(pluginStore.allSearchSource)[plugin])[name]
})
const query = useInfiniteQuery({
  key: () => [
    'search',
    { keyword: route.params.keyword, sort: route.params.sort, method: route.params.method }
  ],
  initialPageParam: method.value.fetchSearchResult.initialPageParam,
  query: async ({ signal, pageParam }) => {
    return await method.value.fetchSearchResult(
      decodeURIComponent(route.params.keyword),
      route.params.sort,
      pageParam,
      signal
    )
  },
  getNextPageParam: lp => lp.nextPage
})

const showSearch = shallowRef(true)
const searchText = shallowRef(decodeURIComponent(route.params.keyword))
</script>

<template>
  <div class="fixed top-0 z-1 w-full bg-(--van-background-2) pt-safe"></div>
  <header
    class="mt-safe h-21.5 w-full text-(--van-text-color) transition-transform duration-200"
    :class="[showSearch ? 'translate-y-0!' : '-translate-y-13.5!']"
  >
    <SearchBar v-model:search-text="searchText" :source="route.params.method" />
    <div class="van-hairline--bottom relative h-8 w-full bg-(--van-background-2)">
      <div class="scroll flex w-full items-center gap-2 overflow-x-auto pr-2 *:text-nowrap!">
        <NPopselect
          :options="
            pluginStore.allSearchSource.map(([plugin, sources]) => ({
              type: 'group',
              label: pluginStore.$getPluginDisplayName(plugin),
              children: sources.map(([id, { name }]) => ({
                label: name,
                value: searchSourceKey.toString([plugin, id])
              }))
            }))
          "
          :value="route.params.method"
          @update:value="
            (v: string) =>
              SharedFunction.call('routeToSearch', searchText, searchSourceKey.parse(v))
          "
          placement="bottom"
          size="large"
        >
          <NButton quaternary>
            搜索源:<span class="text-xs text-(--nui-primary-color)">
              {{
                pluginStore.$getPluginDisplayName(searchSourceKey.toJSON(route.params.method)[0])
              }}:{{ method.name }}
            </span>
            <template #icon>
              <NIcon size="1.8rem">
                <Icons.antd.CloudServerOutlined />
              </NIcon>
            </template>
          </NButton>
        </NPopselect>
        <NPopselect
          :options="method.sorts.map(({ text, value }) => ({ label: text, value }))"
          :value="route.params.sort"
          @update:value="
            (v: string) =>
              SharedFunction.call(
                'routeToSearch',
                searchText,
                searchSourceKey.parse(route.params.method),
                v
              )
          "
        >
          <NButton
            quaternary
            class="van-haptics-feedback flex h-full items-center justify-start text-sm"
          >
            <template #icon> <VanIcon name="sort" size="1.5rem" class="sort-icon" /> </template>排序
            <span class="text-xs text-(--nui-primary-color)">
              -{{ method.sorts.find(v => v.value == route.params.sort)?.text ?? '<不存在>' }}
            </span>
          </NButton>
        </NPopselect>
        <div class="van-haptics-feedback flex h-full items-center justify-start text-sm">
          <NSwitch v-model:value="config.showAIProject" />展示AI作品
        </div>
      </div>
      <VanIcon
        @click="
          () =>
            SharedFunction.call(
              'routeToSearch',
              searchText,
              searchSourceKey.parse(route.params.method)
            )
        "
        :class="[showSearch ? 'translate-x-full' : '-translate-x-2']"
        size="25px"
        class="absolute! top-1/2 right-0 -translate-y-1/2 rounded-full bg-(--van-background-2) p-1 shadow transition-transform duration-200"
        name="search"
        color="var(--van-text-color-2)"
      />
    </div>
  </header>

  <NResult
    status="info"
    title="无搜索"
    class="flex h-[80vh] flex-col items-center justify-center"
    description="请输入"
    v-if="isEmpty(route.params.keyword)"
  >
    <template #icon>
      <DcImage :src="noneSearchTextIcon" />
    </template>
  </NResult>
  <div
    class="min-h-screen transition-all duration-200 will-change-[height,transform] *:h-full!"
    v-else
    :class="[
      showSearch
        ? 'h-[calc(100vh-var(--van-tabs-line-height)-var(--van-tabs-padding-bottom)-var(--safe-area-inset-top))] translate-y-0'
        : 'h-[calc(100vh-32px-var(--safe-area-inset-top))] -translate-y-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom))]'
    ]"
  >
    <DcList
      :itemHeight="140"
      v-slot="{ data: { item } }"
      class="h-full transition-all duration-200 will-change-[transform,height]"
      ref="list"
      :source="{ type: 'infinite', value: query }"
      :dataProcessor="data => (config.showAIProject ? data : data.filter(comic => !comic.$isAi))"
    >
      <component :is="uni.item.Item.itemCards.get(item.contentType)" :item />
    </DcList>
  </div>
</template>
<style scoped>
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