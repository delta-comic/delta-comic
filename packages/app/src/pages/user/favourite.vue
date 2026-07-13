<script setup lang="ts">
import { DBUtils, FavouriteDB, useNativeStore } from '@delta-comic/db'
import { type uni } from '@delta-comic/model'
import { usePluginStore } from '@delta-comic/plugin'
import { createDownloadMessage, DcState } from '@delta-comic/ui'
import { useTemp } from '@delta-comic/utils'
import { isNumber, uniqBy } from 'es-toolkit/compat'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import CreateFavouriteCard from '@/components/createFavouriteCard.vue'
import Searcher from '@/components/listSearcher.vue'
import FavouriteCard from '@/components/user/favouriteCard.vue'
import Layout from '@/components/user/userLayout.vue'
import { Icons } from '@/icons'
import { pluginName } from '@/symbol'

const isCardMode = shallowRef(true)
const { t } = useI18n()
const temp = useTemp().$apply('favourite', () => ({ selectMode: 'pack' }))

const searcher = useTemplateRef<InstanceType<typeof Searcher>>('searcher')

const st = computed(() => searcher.value?.searchText ?? '')

const { state: allFavouriteCardsState } = FavouriteDB.useQueryCard(
  db => db.selectAll().where('title', '=', `%${st.value}%`).orderBy('createAt', 'desc').execute(),
  [],
  () => [],
)

const isSyncing = shallowRef(false)

const { upsert: upsertFavouriteItem } = FavouriteDB.useUpsertItem()
const { createCard } = FavouriteDB.useCreateCard()

const pluginStore = usePluginStore()
const syncFromCloud = () =>
  createDownloadMessage(t('favourite.sync.start'), async ({ createLoading }) => {
    if (isSyncing.value) return
    isSyncing.value = true
    await Promise.all(
      Array.from(pluginStore.plugins.entries()).map(async ([plugin, { user }], index) => {
        if (!user?.syncFavourite) return

        const { download, upload } = user.syncFavourite
        const downloadItems = await createLoading(
          t('favourite.sync.download', { plugin: pluginStore.$getI18nName(plugin) }),
          async c => {
            c.retryable = true
            const downloadItems = await download()
            return downloadItems
          },
        )

        const diff = await createLoading(
          t('favourite.sync.persist', { plugin: pluginStore.$getI18nName(plugin) }),
          c =>
            DBUtils.withTransition(async trx => {
              c.retryable = true
              let diff: uni.item.RawItem[] = []
              c.description = t('favourite.sync.writing')
              await createCard({
                card: {
                  title: t('favourite.sync.folderName', { plugin }),
                  description: '',
                  createAt: index,
                  private: true,
                },
                trx,
              })
              for (const v of downloadItems) {
                await upsertFavouriteItem({ item: v, belongTos: [index], trx })
              }

              c.description = t('favourite.sync.comparing')
              const all = await trx
                .selectFrom('favouriteItem')
                .innerJoin('itemStore', 'favouriteItem.itemKey', 'itemStore.key')
                .selectAll()
                .execute()

              const thisPluginItems = all.filter(v => v.item.$$plugin == plugin).map(v => v.item)
              diff = uniqBy(
                thisPluginItems.filter(v => !downloadItems.some(r => v.id == r.id)),
                v => v.id,
              )
              return diff
            }),
        )

        await createLoading(
          t('favourite.sync.upload', { plugin: pluginStore.$getI18nName(plugin) }),
          async c => {
            c.retryable = true
            await upload(diff)
          },
        )
      }),
    )
    isSyncing.value = false
  })

const createFavouriteCard = useTemplateRef('createFavouriteCard')
const waterfall = useTemplateRef('waterfall')

const mainFilters = useNativeStore(pluginName, 'favourite.mainFilters', new Array<string>())
</script>

<template>
  <Layout :title="t('favourite.title')" :isLoading="isSyncing">
    <template #rightNav>
      <NIcon
        size="calc(var(--spacing) * 6.5)"
        color="var(--dc-text-secondary)"
        @click="syncFromCloud"
      >
        <Icons.antd.CloudSyncOutlined />
      </NIcon>
    </template>
    <template #topNav>
      <Searcher ref="searcher" v-model:filtersHistory="mainFilters" />
    </template>
    <template #bottomNav>
      <div
        class="flex h-12 w-full items-center justify-evenly gap-4 bg-(--dc-surface) pt-4 pr-4 pb-2"
      >
        <div class="w-full pl-4">
          <NButton
            v-for="item of [{ type: 'pack', name: t('favourite.folder') }]"
            class="text-[0.9rem]!"
            size="small"
            :="
              item.type === temp.selectMode
                ? { strong: true, secondary: true, type: 'primary' }
                : { quaternary: true }
            "
            @click="temp.selectMode = item.type"
          >
            {{ item.name }}
          </NButton>
        </div>
        <NIcon
          color="var(--dc-text-secondary)"
          size="1.5rem"
          class="dc-interactive"
          @click="searcher && (searcher!.isSearching = true)"
        >
          <Icons.material.SearchFilled />
        </NIcon>
        <NIcon
          color="var(--dc-text-secondary)"
          size="1.5rem"
          class="dc-interactive"
          @click="createFavouriteCard?.create()"
        >
          <Icons.material.PlusFilled />
        </NIcon>
        <NIcon
          color="var(--dc-text-secondary)"
          size="1.5rem"
          class="dc-interactive"
          @click="
            async () => {
              isCardMode = !isCardMode
              await waterfall?.reloadList()
            }
          "
        >
          <Icons.material.CalendarViewDayRound v-if="isCardMode" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 20 20"
            v-else
          >
            <g fill="none">
              <path
                d="M3.5 4A1.5 1.5 0 0 0 2 5.5v2A1.5 1.5 0 0 0 3.5 9h2A1.5 1.5 0 0 0 7 7.5v-2A1.5 1.5 0 0 0 5.5 4h-2zM3 5.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2zM9.5 5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6zm-6 4A1.5 1.5 0 0 0 2 12.5v2A1.5 1.5 0 0 0 3.5 16h2A1.5 1.5 0 0 0 7 14.5v-2A1.5 1.5 0 0 0 5.5 11h-2zM3 12.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2zm6.5-.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6z"
                fill="currentColor"
              ></path>
            </g>
          </svg>
        </NIcon>
      </div>
    </template>
    <DcState :state="allFavouriteCardsState" v-slot="{ data: allFavouriteCards }">
      <DcWaterfall
        class="h-full!"
        unReloadable
        ref="waterfall"
        :source="{ type: 'array', value: allFavouriteCards }"
        v-slot="{ item }"
        :col="1"
        :gap="6"
        :padding="6"
      >
        <div class="flex items-center justify-center py-10" v-if="isNumber(item)">
          <NButton
            round
            type="tertiary"
            class="px-3! text-xs!"
            size="small"
            @click="createFavouriteCard?.create()"
          >
            {{ t('favourite.actions.newFolder') }}
            <template #icon>
              <NIcon>
                <Icons.material.PlusFilled />
              </NIcon>
            </template>
          </NButton>
        </div>
        <FavouriteCard :height="130" :card="item" :isCardMode v-else />
      </DcWaterfall>
    </DcState>
  </Layout>
  <CreateFavouriteCard ref="createFavouriteCard" />
</template>