<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { useConfig, usePluginStore, type Search } from '@delta-comic/plugin'
import { SharedFunction } from '@delta-comic/utils'
import { useInfiniteQuery } from '@pinia/colada'
import { isEmpty } from 'es-toolkit/compat'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import noneSearchTextIcon from '@/assets/images/none-search-text-icon.webp'
import { searchSourceKey } from '@/components/search/source'
import { Icons } from '@/icons'

const route = useRoute<'/search/[keyword]/[sort]/[method]'>()
const pluginStore = usePluginStore()
const config = useConfig().$loadApp()
const { t } = useI18n()

const allSearchSource = computed(() =>
  Array.from(pluginStore.plugins.values())
    .filter(v => v.search?.methods)
    .map(
      v =>
        [v.name, Object.entries(v.search?.methods ?? {})] as [
          plugin: string,
          sources: [name: string, method: Search.SearchMethod][],
        ],
    ),
)

const method = computed(() => {
  const [plugin, name] = searchSourceKey.toJSON(route.params.method)
  return Object.fromEntries(Object.fromEntries(allSearchSource.value)[plugin])[name]
})
const query = useInfiniteQuery({
  key: () => [
    'search',
    {
      keyword: route.params.keyword,
      sort: route.params.sort,
      method: route.params.method,
      showAI: config.data.value.showAIProject,
    },
  ],
  initialPageParam: method.value.fetchSearchResult.initPage,
  query: async ({ signal, pageParam }) => {
    return await method.value.fetchSearchResult
      .query(
        { input: decodeURIComponent(route.params.keyword), sort: route.params.sort },
        pageParam,
        signal,
      )
      .then(item =>
        config.data.value.showAIProject
          ? item
          : { ...item, data: item.data.filter(item => !item.$isAi) },
      )
  },
  getNextPageParam: lp => lp.nextPage,
})

const showSearch = shallowRef(true)
const searchText = shallowRef(decodeURIComponent(route.params.keyword))
</script>

<template>
  <div class="fixed top-0 z-1 w-full bg-(--dc-surface) pt-safe"></div>
  <header
    class="mt-safe h-21.5 w-full text-(--dc-text) transition-transform duration-200"
    :class="[showSearch ? 'translate-y-0!' : '-translate-y-13.5!']"
  >
    <SearchBar v-model:search-text="searchText" :source="route.params.method" />
    <div class="dc-hairline-bottom relative h-8 w-full bg-(--dc-surface)">
      <div class="scroll flex w-full items-center gap-2 overflow-x-auto pr-2 *:text-nowrap!">
        <NPopselect
          :options="
            allSearchSource.map(([plugin, sources]) => ({
              type: 'group',
              label: pluginStore.$getI18nName(plugin),
              children: sources.map(([id, { name }]) => ({
                label: name,
                value: searchSourceKey.toString([plugin, id]),
              })),
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
            {{ t('search.source') }}:<span class="text-xs text-(--nui-primary-color)">
              {{ pluginStore.$getI18nName(searchSourceKey.toJSON(route.params.method)[0]) }}:{{
                method.name
              }}
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
                v,
              )
          "
        >
          <NButton quaternary class="dc-interactive flex h-full items-center justify-start text-sm">
            <template #icon>
              <NIcon size="1.5rem" class="sort-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M3 6h12v2H3V6Zm0 5h9v2H3v-2Zm0 5h6v2H3v-2Zm14-5V7h2v4h3l-4 4l-4-4h3Z"
                  />
                </svg>
              </NIcon>
            </template>
            {{ t('search.sort') }}
            <span class="text-xs text-(--nui-primary-color)">
              -{{
                method.sorts.find(v => v.value == route.params.sort)?.text ??
                t('common.status.missing')
              }}
            </span>
          </NButton>
        </NPopselect>
        <div class="dc-interactive flex h-full items-center justify-start gap-1 text-sm">
          <NSwitch v-model:value="config.data.value.showAIProject" />{{ t('search.showAiWorks') }}
        </div>
      </div>
      <button
        type="button"
        :aria-label="t('search.actions.searchAgain')"
        @click="
          () =>
            SharedFunction.call(
              'routeToSearch',
              searchText,
              searchSourceKey.parse(route.params.method),
            )
        "
        :class="[showSearch ? 'translate-x-full' : '-translate-x-2']"
        class="dc-interactive absolute! top-1/2 right-0 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-(--dc-surface) p-1 text-(--dc-text-secondary) shadow transition-transform duration-200"
      >
        <NIcon size="25">
          <Icons.material.SearchFilled />
        </NIcon>
      </button>
    </div>
  </header>

  <NResult
    status="info"
    :title="t('search.empty.title')"
    class="flex h-[80vh] flex-col items-center justify-center"
    :description="t('search.empty.description')"
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
        ? 'h-[calc(100vh-var(--dc-tabs-height)-var(--dc-tabs-padding-bottom)-var(--safe-area-inset-top))] translate-y-0'
        : 'h-[calc(100vh-32px-var(--safe-area-inset-top))] -translate-y-[calc(var(--dc-tabs-height)+var(--dc-tabs-padding-bottom))]',
    ]"
  >
    <DcList
      :minHeight="140"
      v-slot="{ item }"
      class="h-full transition-all duration-200 will-change-[transform,height]"
      ref="list"
      :source="{ type: 'stream', value: query }"
    >
      <component :is="uni.item.Item.itemCards.get(item.contentType)" :item />
    </DcList>
  </div>
</template>