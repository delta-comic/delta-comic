<script setup lang="ts">
import { useContentStore } from '@/stores/content'
import { db, type FavouriteDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { DcImage, DcVar } from '@delta-comic/ui'
import { LockOutlined } from '@vicons/antd'
import { ArrowForwardIosRound } from '@vicons/material'
import { computedAsync } from '@vueuse/core'
import { isEmpty } from 'es-toolkit/compat'
import { useRouter } from 'vue-router'
const $props = defineProps<{ isCardMode?: boolean; card: FavouriteDB.Card }>()

const favouriteItems = computedAsync(
  () =>
    db.value
      .selectFrom('favouriteItem')
      .where('belongTo', '=', $props.card.createAt)
      .innerJoin('itemStore', 'favouriteItem.itemKey', 'itemStore.key')
      .selectAll()
      .orderBy('addTime', 'desc')
      .execute(),
  []
)
const $router = useRouter()
const contentStore = useContentStore()
const handleClick = (rawItem: uni.item.RawItem) => {
  const item = uni.item.Item.create(rawItem)
  return contentStore.$load(item.contentType, item.id, item.$thisEp.index, item)
}
</script>

<template>
  <div
    v-if="isCardMode"
    @click="$router.force.push({ name: '/user/favourite/[id]', params: { id: card.createAt } })"
    class="active:bg-gray van-haptics-feedback relative flex w-full flex-col items-center overflow-hidden rounded-xl border-none bg-(--van-background-2) bg-center p-3 text-(--van-text-color)"
  >
    <div class="relative flex h-6 w-full items-center">
      <div class="text-lg font-semibold">{{ card.title }}</div>
      <div class="absolute right-1 flex items-center text-[13px] text-(--van-text-color-2)">
        <template v-if="card.private">
          <NIcon size="16px">
            <LockOutlined />
          </NIcon>
          <span class="mx-1">·</span>
        </template>
        {{ favouriteItems.length }}个内容
        <NIcon size="15px">
          <ArrowForwardIosRound />
        </NIcon>
      </div>
    </div>
    <div class="mt-3 flex justify-around">
      <template v-if="isEmpty(favouriteItems)">
        <NEmpty description="无结果" class="w-full justify-center!" />
      </template>
      <template v-else>
        <div
          v-for="{ item } of favouriteItems.slice(0, 3)"
          class="flex w-[30%] flex-col gap-2"
          @click="handleClick(item)"
        >
          <DcVar :value="item" v-slot="{ value: item }">
            <DcImage
              :src="uni.image.Image.create(item.cover)"
              class="z-2 rounded-lg!"
              fit="cover"
            />
            <div class="van-multi-ellipsis--l2">{{ item.title }}</div>
          </DcVar>
        </div>
      </template>
    </div>
  </div>
  <div
    v-else
    @click="$router.force.push({ name: '/user/favourite/[id]', params: { id: card.createAt } })"
    class="active:bg-gray van-haptics-feedback relative flex min-h-25 w-full items-center overflow-hidden rounded-xl border-none bg-(--van-background-2) bg-center p-3 text-(--van-text-color)"
  >
    <DcVar :value="favouriteItems[0].item" v-slot="{ value: item }">
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
        <div class="absolute bottom-4 flex w-full items-center text-sm text-(--van-text-color-2)">
          <template v-if="card.private">
            <NIcon size="16px">
              <LockOutlined />
            </NIcon>
            <span class="mx-0.5">·</span>
          </template>
          {{ favouriteItems.length }}个内容
        </div>
      </div>
    </DcVar>
  </div>
</template>