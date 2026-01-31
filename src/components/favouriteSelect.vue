<script setup lang='ts'>
import { useTemplateRef, shallowRef, shallowReactive } from 'vue'
import { PlusFilled, StarOutlineRound } from '@vicons/material'
import { useMessage } from 'naive-ui'
import { Comp, uni, } from 'delta-comic-core'
import { FavouriteDB } from '@/db/favourite'
import { StarFilled } from '@vicons/antd'
import { db, DBUtils } from '@/db'
import { computedAsync } from '@vueuse/core'


const $props = defineProps<{
  item: uni.item.Item
  plain?: boolean
}>()

const createFavouriteCard = useTemplateRef('createFavouriteCard')
const selectList = shallowReactive(new Set<(FavouriteDB.Card['createAt'])>())

const allFavouriteCards = computedAsync(() => db.value.selectFrom('favouriteCard').selectAll().execute(), [])
const getCardCount = (createAt: FavouriteDB.Card['createAt']) => DBUtils.countDb(db.value
  .selectFrom('favouriteItem')
  .where('belongTo', '=', createAt))

const isShow = shallowRef(false)
const $message = useMessage()

let promise = Promise.withResolvers<(FavouriteDB.Card['createAt'])[]>()

const create = async () => {
  console.log('create popup for favselect')
  promise = Promise.withResolvers<(FavouriteDB.Card['createAt'])[]>()
  if (isShow.value) {
    $message.warning('正在选择中')
    promise.reject()
    return promise.promise
  }
  selectList.clear()
  console.log('favselect getting data')
  const items = await db.value
    .selectFrom('favouriteItem')
    .where('itemKey', '=', $props.item.id)
    .selectAll()
    .execute()
  console.log('favselect done', selectList)
  for (const v of items) selectList.add(v.belongTo)
  isShow.value = true
  return await promise.promise
}
const submit = () => {
  if (selectList.size === 0) {
    return $message.warning('不可为空')
  }
  promise.resolve([...selectList])
  selectList.clear()
  isShow.value = false
}

const favouriteThis = async (inCard: FavouriteDB.Card['createAt'][]) =>
  db.value.transaction().execute(async () => {
    for (const card of inCard)
      await FavouriteDB.upsertItem($props.item, card)
  })

const thisFavouriteCount = computedAsync(() => DBUtils.countDb(db.value
  .selectFrom('favouriteItem')
  .where('itemKey', '=', $props.item.id))
  , 0)

</script>

<template>
  <Comp.ToggleIcon padding :size="plain ? '35px' : '27px'" @long-click="create().then(favouriteThis)"
    @click="favouriteThis([0])" :model-value="thisFavouriteCount > 0" :icon="plain ? StarOutlineRound : StarFilled">
    {{ plain ? '' : '收藏' }}
  </Comp.ToggleIcon>
  <Comp.Popup v-model:show="isShow" position="bottom" round class="bg-(--van-background)!" @closed="promise.reject()">
    <div class="m-(--van-cell-group-inset-padding) w-full mb-2! mt-2 font-semibold relative">
      选择收藏夹
      <div @click="createFavouriteCard?.create()"
        class="flex items-center font-normal text-(--van-text-color-2) text-xs! absolute right-8 top-1/2 -translate-y-1/2">
        <NIcon>
          <PlusFilled />
        </NIcon>
        新建收藏夹
      </div>
    </div>
    <VanCellGroup inset class="mb-6!">
      <Comp.Await v-for="card of allFavouriteCards" v-slot="{ result: count }" auto-load
        :promise="() => getCardCount(card.createAt)">
        <VanCell center :title="card.title" :label="`${count ?? 0}个内容`" clickable
          @click="selectList.has(card.createAt) ? selectList.delete(card.createAt) : selectList.add(card.createAt)">
          <template #right-icon>
            <NCheckbox :checked="selectList.has(card.createAt)" />
          </template>
        </VanCell>
      </Comp.Await>
    </VanCellGroup>
    <NButton class="m-5! w-30!" @click="submit" strong secondary type="primary" size="large">
      确定
    </NButton>
  </Comp.Popup>
  <CreateFavouriteCard ref="createFavouriteCard" />
</template>