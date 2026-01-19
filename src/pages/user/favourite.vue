<script setup lang='ts'>
import { CloudSyncOutlined } from '@vicons/antd'
import Layout from '../layout.vue'
import { CalendarViewDayRound, PlusRound, SearchFilled } from '@vicons/material'
import { shallowRef, useTemplateRef } from 'vue'
import { isNumber, uniqBy } from 'es-toolkit/compat'
import FavouriteCard from './favouriteCard.vue'
import Searcher from '../searcher.vue'
import { Store, Utils, Comp, uni } from 'delta-comic-core'
import { usePluginStore } from '@/plugin/store'
import CreateFavouriteCard from '@/components/createFavouriteCard.vue'
import { computedAsync } from '@vueuse/core'
import { db, useNativeStore } from '@/db'
import { FavouriteDB } from '@/db/favourite'
import { pluginName } from '../../../symbol'
const isCardMode = shallowRef(true)

const temp = Store.useTemp().$apply('favourite', () => ({
  selectMode: 'pack'
}))

const allFavouriteCards = computedAsync(() => db.value
  .selectFrom('favouriteCard')
  .selectAll()
  .orderBy('createAt', 'desc')
  .execute()
  , [])
const searcher = useTemplateRef('searcher')

const isSyncing = shallowRef(false)

const pluginStore = usePluginStore()
const syncFromCloud = () => Utils.message.createDownloadMessage('同步收藏数据中', async ({ createLoading }) => {
  if (isSyncing.value) return
  isSyncing.value = true
  await Promise.all(Array.from(pluginStore.plugins.entries()).map(async ([plugin, { user }], index) => {
    if (!user?.syncFavourite) return

    const { download, upload } = user.syncFavourite
    const downloadItems = await createLoading(`同步<${pluginStore.$getPluginDisplayName(plugin)}>-下载`, async c => {
      c.retryable = true
      const downloadItems = await download()
      return downloadItems
    })

    const diff = await createLoading(`同步<${pluginStore.$getPluginDisplayName(plugin)}>-写入数据库`, async c => {
      c.retryable = true
      let diff: uni.item.RawItem[] = []
      c.description = '等待中'
      await db.value.transaction()
        .setIsolationLevel('serializable')
        .execute(async trx => {
          c.description = '写入中'
          await trx
            .replaceInto('favouriteCard')
            .values({
              title: `同步文件夹-${plugin}`,
              description: '',
              createAt: index,
              private: true
            })
            .execute()

          for (const v of downloadItems) {
            FavouriteDB.upsertItem(v, index)
          }

          c.description = '对比差异中'
          const all = await trx
            .selectFrom('favouriteItem')
            .innerJoin('itemStore', 'favouriteItem.itemKey', 'itemStore.key')
            .selectAll()
            .execute()

          const thisPluginItems = all.filter(v => v.item.$$plugin == plugin).map(v => v.item)
          diff = uniqBy(thisPluginItems.filter(v => !downloadItems.some(r => v.id == r.id)), v => v.id)

        })
      return diff
    })

    await createLoading(`同步<${pluginStore.$getPluginDisplayName(plugin)}>-上传`, async c => {
      c.retryable = true
      await upload(diff)
    })
  }))
  isSyncing.value = false
})

const createFavouriteCard = useTemplateRef('createFavouriteCard')
const waterfall = useTemplateRef('waterfall')


const mainFilters = useNativeStore(pluginName, 'favourite.mainFilters', new Array<string>())
</script>

<template>
  <Layout title="我的收藏" :isLoading="isSyncing">
    <template #rightNav>
      <NIcon size="calc(var(--spacing) * 6.5)" color="var(--van-text-color-2)" @click="syncFromCloud">
        <CloudSyncOutlined />
      </NIcon>
    </template>
    <template #topNav>
      <Searcher ref="searcher" v-model:filtersHistory="mainFilters" />
    </template>
    <template #bottomNav>
      <div class="w-full bg-(--van-background-2) h-12 items-center flex justify-evenly pt-4 pb-2 gap-4 pr-4">
        <div class="w-full pl-4">
          <NButton v-for="item of [{
            type: 'pack',
            name: '收藏夹'
          }]" class="text-[0.9rem]! " size="small" :="item.type === temp.selectMode ? {
            strong: true,
            secondary: true,
            type: 'primary'
          } : { quaternary: true }" @click="temp.selectMode = item.type">
            {{ item.name }}
          </NButton>
        </div>
        <NIcon color="var(--van-text-color-2)" size="1.5rem" class="van-haptics-feedback"
          @click="searcher && (searcher!.isSearching = true)">
          <SearchFilled />
        </NIcon>
        <NIcon color="var(--van-text-color-2)" size="1.5rem" class="van-haptics-feedback"
          @click="createFavouriteCard?.create()">
          <PlusRound />
        </NIcon>
        <NIcon color="var(--van-text-color-2)" size="1.5rem" class="van-haptics-feedback" @click="async () => {
          isCardMode = !isCardMode
          await waterfall?.reloadList()
        }">
          <CalendarViewDayRound v-if="isCardMode" />
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" v-else>
            <g fill="none">
              <path
                d="M3.5 4A1.5 1.5 0 0 0 2 5.5v2A1.5 1.5 0 0 0 3.5 9h2A1.5 1.5 0 0 0 7 7.5v-2A1.5 1.5 0 0 0 5.5 4h-2zM3 5.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2zM9.5 5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6zm-6 4A1.5 1.5 0 0 0 2 12.5v2A1.5 1.5 0 0 0 3.5 16h2A1.5 1.5 0 0 0 7 14.5v-2A1.5 1.5 0 0 0 5.5 11h-2zM3 12.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2zm6.5-.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6z"
                fill="currentColor"></path>
            </g>
          </svg>
        </NIcon>
      </div>
    </template>
    <Comp.Waterfall class="h-full!" unReloadable ref="waterfall"
      :source="{ data: Utils.data.PromiseContent.resolve(allFavouriteCards), isEnd: true }"
      :data-processor="v => v.filter(v => isNumber(v) || v.title.includes(searcher?.searchText ?? ''))"
      v-slot="{ item }" :col="1" :gap="6" :padding="6">
      <div class="flex justify-center items-center py-10" v-if="isNumber(item)">
        <NButton round type="tertiary" class="px-3! text-xs! " size="small" @click="createFavouriteCard?.create()">
          新建收藏夹
          <template #icon>
            <NIcon>
              <PlusRound />
            </NIcon>
          </template>
        </NButton>
      </div>
      <FavouriteCard :height="130" :card="item" :isCardMode v-else />

    </Comp.Waterfall>
  </Layout>
  <CreateFavouriteCard ref="createFavouriteCard" />

</template>