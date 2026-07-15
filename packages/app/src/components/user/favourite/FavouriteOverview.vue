<script setup lang="ts">
import { DBUtils, FavouriteDB, useNativeStore } from '@delta-comic/db'
import { type uni } from '@delta-comic/model'
import { usePluginStore } from '@delta-comic/plugin'
import { createDownloadMessage, DcState } from '@delta-comic/ui'
import { useTemp } from '@delta-comic/utils'
import { uniqBy } from 'es-toolkit/compat'
import { useMessage } from 'naive-ui'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import CreateFavouriteCard from '@/components/createFavouriteCard.vue'
import Searcher from '@/components/listSearcher.vue'
import Layout from '@/components/user/userLayout.vue'
import { Icons } from '@/icons'
import { pluginName } from '@/symbol'

import FavouriteFolderList from './FavouriteFolderList.vue'

const isCardMode = shallowRef(true)
const isSyncing = shallowRef(false)
const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const temp = useTemp().$apply('favourite', () => ({ selectMode: 'pack' }))

const searcher = useTemplateRef<InstanceType<typeof Searcher>>('searcher')
const searchText = computed(() => searcher.value?.searchText ?? '')

const { state: allFavouriteCardsState } = FavouriteDB.useQueryCard(
  db =>
    db
      .selectAll()
      .where('title', 'like', `%${searchText.value}%`)
      .orderBy('createAt', 'desc')
      .execute(),
  [() => searchText.value],
  () => [],
)

const { upsert: upsertFavouriteItem } = FavouriteDB.useUpsertItem()
const { createCard } = FavouriteDB.useCreateCard()

const pluginStore = usePluginStore()
const syncFromCloud = () =>
  createDownloadMessage(t('favourite.sync.start'), async ({ createLoading }) => {
    if (isSyncing.value) return
    isSyncing.value = true
    try {
      await Promise.all(
        Array.from(pluginStore.plugins.entries()).map(async ([plugin, { user }], index) => {
          if (!user?.syncFavourite) return

          const { download, upload } = user.syncFavourite
          const downloadItems = await createLoading(
            t('favourite.sync.download', { plugin: pluginStore.$getI18nName(plugin) }),
            async c => {
              c.retryable = true
              return await download()
            },
          )

          const diff = await createLoading(
            t('favourite.sync.persist', { plugin: pluginStore.$getI18nName(plugin) }),
            c =>
              DBUtils.withTransition(async trx => {
                let diff: uni.item.RawItem[] = []
                c.retryable = true
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
                for (const item of downloadItems) {
                  await upsertFavouriteItem({ item, belongTos: [index], trx })
                }

                c.description = t('favourite.sync.comparing')
                const allItems = await trx
                  .selectFrom('favouriteItem')
                  .innerJoin('itemStore', 'favouriteItem.itemKey', 'itemStore.key')
                  .selectAll()
                  .execute()

                const pluginItems = allItems
                  .filter(item => item.item.$$plugin === plugin)
                  .map(item => item.item)
                diff = uniqBy(
                  pluginItems.filter(item => !downloadItems.some(remote => item.id === remote.id)),
                  item => item.id,
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
    } finally {
      isSyncing.value = false
    }
  })

const createFavouriteCard =
  useTemplateRef<InstanceType<typeof CreateFavouriteCard>>('createFavouriteCard')
const mainFilters = useNativeStore(pluginName, 'favourite.mainFilters', new Array<string>())

const toggleDisplayMode = () => {
  isCardMode.value = !isCardMode.value
}

const openFavouriteCard = (card: FavouriteDB.Card) =>
  router.push({ name: '/user/favourite/[id]', params: { id: card.createAt } })

const showPlayUnavailable = () => {
  message.error(t('favourite.feedback.playUnavailable'))
}
</script>

<template>
  <Layout :title="t('favourite.title')" :is-loading="isSyncing">
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
      <Searcher ref="searcher" v-model:filters-history="mainFilters" />
    </template>
    <template #bottomNav>
      <div
        class="flex h-12 w-full items-center justify-evenly gap-4 bg-(--dc-surface) pt-4 pr-4 pb-2"
      >
        <div class="w-full pl-4">
          <NButton
            v-for="item of [{ type: 'pack', name: t('favourite.folder') }]"
            :key="item.type"
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
          @click="searcher && (searcher.isSearching = true)"
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
        <button
          type="button"
          class="dc-interactive flex size-7 items-center justify-center text-(--dc-text-secondary)"
          :aria-label="
            t(
              isCardMode
                ? 'favourite.actions.switchToListView'
                : 'favourite.actions.switchToCardView',
            )
          "
          @click="toggleDisplayMode"
        >
          <NIcon size="1.5rem">
            <Icons.material.CalendarViewDayRound v-if="isCardMode" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <g fill="none">
                <path
                  d="M3.5 4A1.5 1.5 0 0 0 2 5.5v2A1.5 1.5 0 0 0 3.5 9h2A1.5 1.5 0 0 0 7 7.5v-2A1.5 1.5 0 0 0 5.5 4h-2zM3 5.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2zM9.5 5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6zm-6 4A1.5 1.5 0 0 0 2 12.5v2A1.5 1.5 0 0 0 3.5 16h2A1.5 1.5 0 0 0 7 14.5v-2A1.5 1.5 0 0 0 5.5 11h-2zM3 12.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2zm6.5-.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6z"
                  fill="currentColor"
                />
              </g>
            </svg>
          </NIcon>
        </button>
      </div>
    </template>
    <DcState :state="allFavouriteCardsState" v-slot="{ data: allFavouriteCards }">
      <FavouriteFolderList
        :cards="allFavouriteCards"
        :is-card-mode="isCardMode"
        @create="createFavouriteCard?.create()"
        @open="openFavouriteCard"
        @play="showPlayUnavailable"
      />
    </DcState>
  </Layout>
  <CreateFavouriteCard ref="createFavouriteCard" />
</template>