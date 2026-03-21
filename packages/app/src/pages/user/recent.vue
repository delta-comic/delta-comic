<script setup lang="ts">
import { RecentDB, useNativeStore } from '@delta-comic/db'
import { PromiseContent } from '@delta-comic/model'
import { createDialog, DcState } from '@delta-comic/ui'
import { useTemplateRef } from 'vue'

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
  () => []
)


const searcher = useTemplateRef('searcher')


const { remove } = RecentDB.useRemove()
const actionController = useTemplateRef('actionController')
const removeItems = async (item: RecentDB.Item[]) => {
  actionController.value!.showSelect = false
  await remove({ items: item.map(v => v.timestamp) })
  actionController.value?.selectList.clear()
}


const filters = useNativeStore(pluginName, 'recentView.filter', new Array<string>())
</script>

<template>
  <DcState :state="recentState" v-slot="{ data: recent }" class="size-fit" contentClass="size-fit">
    <Action
      ref="actionController"
      :action="[
        {
          text: '删除',
          color: 'var(--van-danger-color)',
          onTrigger(sel) {
            createDialog({
              type: 'warning',
              title: '警告',
              content: `你确认删除${sel.length}项?`,
              positiveText: '确定',
              negativeText: '取消',
              onPositiveClick: () => removeItems(sel)
            })
          }
        }
      ]"
      :values="recent"
      v-slot="{ ActionBar, SelectPacker }"
    >
      <Layout title="稍后再看">
        <template #rightNav>
          <NIcon
            size="calc(var(--spacing) * 6.5)"
            class="van-haptics-feedback"
            @click="searcher && (searcher!.isSearching = true)"
            color="var(--van-text-color-2)"
          >
            <Icons.material.SearchFilled />
          </NIcon>
        </template>
        <template #topNav>
          <component :is="ActionBar" />
          <Searcher ref="searcher" v-model:filters-history="filters" />
        </template>
        <template #bottomNav>
          <div
            class="flex h-12 w-full items-center justify-end bg-(--van-background-2) pt-4 pr-3 pb-2"
          >
            <NIcon
              size="1.5rem"
              class="van-haptics-feedback"
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
          :source="{ data: PromiseContent.resolve(recent), isEnd: true }"
          v-slot="{ item }"
          :col="1"
          :gap="0"
          :padding="0"
          :minHeight="0"
        >
          <VanSwipeCell class="relative w-full">
            <component :is="SelectPacker" :it="item">
              <RecentCard :height="130" :item />
            </component>
            <template #right>
              <VanButton
                square
                text="删除"
                type="danger"
                class="h-full!"
                @click="removeItems([item])"
              />
            </template>
          </VanSwipeCell>
        </DcWaterfall>
      </Layout>
    </Action>
  </DcState>
</template>