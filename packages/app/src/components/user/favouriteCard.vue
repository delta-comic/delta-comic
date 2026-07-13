<script setup lang="ts">
import { FavouriteDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { DcState } from '@delta-comic/ui'
import { isEmpty } from 'es-toolkit/compat'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { Icons } from '@/icons'
import { useContentStore } from '@/stores/content'
const $props = defineProps<{ isCardMode?: boolean; card: FavouriteDB.Card }>()
const { t } = useI18n()

const { state: favouriteItems } = FavouriteDB.useQueryItem(
  db =>
    db
      .where('belongTo', '=', $props.card.createAt)
      .innerJoin('itemStore', 'favouriteItem.itemKey', 'itemStore.key')
      .selectAll()
      .orderBy('addTime', 'desc')
      .execute(),
  [() => $props.card.createAt],
  () => [],
)

const $router = useRouter()
const contentStore = useContentStore()
const handleClick = (rawItem: uni.item.RawItem) => {
  const item = uni.item.Item.create(rawItem)
  return contentStore.$load(item.contentType, item.id, item.$thisEp.id, item)
}
</script>

<template>
  <DcState
    :state="favouriteItems"
    v-slot="{ data: fItems }"
    class="size-fit"
    contentClass="size-fit"
  >
    <div
      v-if="isCardMode"
      @click="$router.force.push({ name: '/user/favourite/[id]', params: { id: card.createAt } })"
      class="active:bg-gray dc-interactive relative flex w-full flex-col items-center overflow-hidden rounded-xl border-none bg-(--dc-surface) bg-center p-3 text-(--dc-text)"
    >
      <div class="relative flex h-6 w-full items-center">
        <div class="text-lg font-semibold">{{ card.title }}</div>
        <div class="absolute right-1 flex items-center text-[13px] text-(--dc-text-secondary)">
          <template v-if="card.private">
            <NIcon size="16px">
              <Icons.antd.LockOutlined />
            </NIcon>
            <span class="mx-1">·</span>
          </template>
          {{ t('common.units.contentCount', { count: fItems.length }) }}
          <NIcon size="15px">
            <Icons.material.ArrowForwardIosRound />
          </NIcon>
        </div>
      </div>
      <div class="mt-3 flex justify-around">
        <template v-if="isEmpty(fItems)">
          <NEmpty :description="t('common.status.noResults')" class="w-full justify-center!" />
        </template>
        <template v-else>
          <div
            v-for="{ item } of fItems.slice(0, 3)"
            class="flex w-[30%] flex-col gap-2"
            @click="handleClick(item)"
          >
            <DcVar :value="item" v-slot="{ value: item }">
              <DcImage
                :src="uni.image.Image.create(item.cover)"
                class="z-2 rounded-lg!"
                fit="cover"
              />
              <div class="dc-clamp-2">{{ item.title }}</div>
            </DcVar>
          </div>
        </template>
      </div>
    </div>
    <div
      v-else
      @click="$router.force.push({ name: '/user/favourite/[id]', params: { id: card.createAt } })"
      class="active:bg-gray dc-interactive relative flex min-h-25 w-full items-center overflow-hidden rounded-xl border-none bg-(--dc-surface) bg-center p-3 text-(--dc-text)"
    >
      <DcVar :value="fItems[0].item" v-slot="{ value: item }">
        <div class="w-[40%]">
          <DcImage
            :src="uni.image.Image.create(item.cover)"
            class="z-2 ml-[1%] h-full rounded-lg!"
            fit="contain"
          />
        </div>
        <div class="ml-2 flex size-full">
          <div class="absolute top-1 w-full text-lg font-semibold">
            {{ card.title }}
          </div>
          <div
            class="absolute bottom-4 flex w-full items-center text-sm text-(--dc-text-secondary)"
          >
            <template v-if="card.private">
              <NIcon size="16px">
                <Icons.antd.LockOutlined />
              </NIcon>
              <span class="mx-0.5">·</span>
            </template>
            {{ t('common.units.contentCount', { count: fItems.length }) }}
          </div>
        </div>
      </DcVar>
    </div>
  </DcState>
</template>