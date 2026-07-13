<script setup lang="ts">
import { HistoryDB, useNativeStore } from '@delta-comic/db'
import { useConfig } from '@delta-comic/plugin'
import { DcState } from '@delta-comic/ui'
import { useDialog } from 'naive-ui'
import { shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Action from '@/components/listAction.vue'
import Searcher from '@/components/listSearcher.vue'
import HistoryCard from '@/components/user/historyCard.vue'
import Layout from '@/components/user/userLayout.vue'
import { Icons } from '@/icons'
import { pluginName } from '@/symbol'

const { state: historiesState } = HistoryDB.useQuery(
  db =>
    db
      .innerJoin('itemStore', 'history.itemKey', 'itemStore.key')
      .selectAll()
      .orderBy('history.timestamp', 'desc')
      .execute(),
  [],
  () => [],
)
const config = useConfig().$loadApp()
const searcher = useTemplateRef('searcher')

const showConfig = shallowRef(false)

const { remove } = HistoryDB.useRemove()
const actionController = useTemplateRef('actionController')
const removeItems = async (item: HistoryDB.Item[]) => {
  if (actionController.value) actionController.value.showSelect = false
  await remove({ keys: item.map(v => v.timestamp) })
  actionController.value?.selectList.clear()
}

const filters = useNativeStore(pluginName, 'history.filter', new Array<string>())

const $dialog = useDialog()
const { t } = useI18n()
</script>

<template>
  <DcState
    :state="historiesState"
    v-slot="{ data: histories }"
    class="size-fit"
    contentClass="size-fit"
  >
    <Action
      ref="actionController"
      :action="[
        {
          text: t('common.actions.delete'),
          color: 'var(--dc-error)',
          onTrigger(sel) {
            $dialog.create({
              type: 'warning',
              title: t('common.dialog.warning'),
              content: t('common.dialog.confirmDeleteItems', { count: sel.length }),
              positiveText: t('common.actions.confirm'),
              negativeText: t('common.actions.cancel'),
              onPositiveClick: () => removeItems(sel),
            })
          },
        },
      ]"
      :values="histories"
      v-slot="{ ActionBar, SelectPacker }"
    >
      <Layout :title="t('history.title')">
        <template #rightNav>
          <NIcon
            size="calc(var(--spacing) * 6.5)"
            class="dc-interactive"
            @click="searcher && (searcher!.isSearching = true)"
            color="var(--dc-text-secondary)"
          >
            <Icons.material.SearchFilled />
          </NIcon>
          <NIcon
            size="calc(var(--spacing) * 6.5)"
            class="dc-interactive rotate-90"
            @click="showConfig = true"
            color="var(--dc-text-secondary)"
          >
            <Icons.material.MoreHorizRound />
          </NIcon>
        </template>
        <template #topNav>
          <component :is="ActionBar" />
          <Searcher ref="searcher" v-model:filters-history="filters" />
        </template>
        <template #bottomNav>
          <div class="flex h-12 w-full items-center justify-end bg-(--dc-surface) pt-4 pr-3 pb-2">
            <NIcon
              size="1.5rem"
              class="dc-interactive"
              @click="actionController!.showSelect = true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 24 24"
              >
                <g fill="none">
                  <path
                    d="M6.78 4.78a.75.75 0 0 0-1.06-1.06L3.75 5.69l-.47-.47a.75.75 0 0 0-1.06 1.06l1 1a.75.75 0 0 0 1.06 0l2.5-2.5zm14.47 13.227H9.75l-.102.007a.75.75 0 0 0 .102 1.493h11.5l.102-.007a.75.75 0 0 0-.102-1.493zm0-6.507H9.75l-.102.007A.75.75 0 0 0 9.75 13h11.5l.102-.007a.75.75 0 0 0-.102-1.493zm0-6.5H9.75l-.102.007A.75.75 0 0 0 9.75 6.5h11.5l.102-.007A.75.75 0 0 0 21.25 5zM6.78 17.78a.75.75 0 1 0-1.06-1.06l-1.97 1.97l-.47-.47a.75.75 0 0 0-1.06 1.06l1 1a.75.75 0 0 0 1.06 0l2.5-2.5zm0-7.56a.75.75 0 0 1 0 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-1-1a.75.75 0 1 1 1.06-1.06l.47.47l1.97-1.97a.75.75 0 0 1 1.06 0z"
                    fill="currentColor"
                  ></path>
                </g>
              </svg>
            </NIcon>
          </div>
        </template>
        <DcWaterfall
          class="h-full!"
          unReloadable
          :source="{ type: 'array', value: histories }"
          v-slot="{ item }"
          :col="1"
          :gap="0"
          :padding="0"
          :minHeight="0"
        >
          <div class="mx-auto flex w-full max-w-5xl items-stretch border-b border-(--dc-border)">
            <div class="min-w-0 flex-1">
              <component :is="SelectPacker" :it="item">
                <HistoryCard :height="130" :item />
              </component>
            </div>
            <div class="flex w-18 shrink-0 items-center justify-center px-2 sm:w-24">
              <NPopconfirm
                :positive-text="t('common.actions.delete')"
                :negative-text="t('common.actions.cancel')"
                @positive-click="removeItems([item])"
              >
                <template #trigger>
                  <NButton type="error" secondary class="w-full">
                    {{ t('common.actions.delete') }}
                  </NButton>
                </template>
                {{ t('history.confirmDelete') }}
              </NPopconfirm>
            </div>
          </div>
        </DcWaterfall>
      </Layout>
    </Action>
  </DcState>
  <NDrawer v-model:show="showConfig" position="bottom" round class="bg-(--dc-background)!">
    <div class="m-(--dc-content-padding) mt-4 mb-2! w-full font-semibold">
      {{ t('history.settings.title') }}
    </div>
    <DcCellGroup inset class="mb-6!">
      <DcCell
        center
        :title="t('history.settings.tracking')"
        :label="t('history.settings.trackingDescription')"
        @click="config.data.value.recordHistory = !config.data.value.recordHistory"
      >
        <template #right-icon>
          <NSwitch size="large" v-model:value="config.data.value.recordHistory" @click.stop />
        </template>
      </DcCell>
    </DcCellGroup>
  </NDrawer>
</template>