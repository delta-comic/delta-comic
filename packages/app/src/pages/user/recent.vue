<script setup lang="ts">
import { RecentDB, useNativeStore } from '@delta-comic/db'
import { DcState } from '@delta-comic/ui'
import { useDialog } from 'naive-ui'
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Action from '@/components/listAction.vue'
import Searcher from '@/components/listSearcher.vue'
import RecentCard from '@/components/user/recentCard.vue'
import Layout from '@/components/user/userLayout.vue'
import { Icons } from '@/icons'
import { pluginName } from '@/symbol'

const { state: recentState } = RecentDB.useQuery(
  db =>
    db
      .innerJoin('itemStore', 'recentView.itemKey', 'itemStore.key')
      .selectAll()
      .orderBy('recentView.timestamp', 'desc')
      .execute(),
  [],
  () => [],
)

const searcher = useTemplateRef('searcher')

const { remove } = RecentDB.useRemove()
const actionController = useTemplateRef('actionController')
const removeItems = async (item: RecentDB.Item[]) => {
  if (actionController.value) actionController.value.showSelect = false
  await remove({ items: item.map(v => v.timestamp) })
  actionController.value?.selectList.clear()
}

const filters = useNativeStore(pluginName, 'recentView.filter', new Array<string>())

const $dialog = useDialog()
const { t } = useI18n()
</script>

<template>
  <DcState :state="recentState" v-slot="{ data: recent }" class="size-fit" contentClass="size-fit">
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
      :values="recent"
      v-slot="{ ActionBar, SelectPacker }"
    >
      <Layout :title="t('recent.title')">
        <template #rightNav>
          <NIcon
            size="calc(var(--spacing) * 6.5)"
            class="dc-interactive"
            @click="searcher && (searcher!.isSearching = true)"
            color="var(--dc-text-secondary)"
          >
            <Icons.material.SearchFilled />
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
          un-reloadable
          :source="{ type: 'array', value: recent }"
          v-slot="{ item }"
          :col="1"
          :gap="0"
          :padding="0"
          :minHeight="0"
        >
          <div class="mx-auto flex w-full max-w-5xl items-stretch border-b border-(--dc-border)">
            <div class="min-w-0 flex-1">
              <component :is="SelectPacker" :it="item">
                <RecentCard :height="130" :item />
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
                {{ t('recent.confirmRemove') }}
              </NPopconfirm>
            </div>
          </div>
        </DcWaterfall>
      </Layout>
    </Action>
  </DcState>
</template>