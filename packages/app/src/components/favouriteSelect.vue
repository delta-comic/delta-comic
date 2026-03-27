<script setup lang="ts">
import { db, DBUtils, FavouriteDB } from '@delta-comic/db'
import type { uni } from '@delta-comic/model'
import { DcToggleIcon, DcState } from '@delta-comic/ui'
import { useMessage } from 'naive-ui'
import { useTemplateRef, shallowRef, shallowReactive } from 'vue'

import { Icons } from '@/icons'

const $props = defineProps<{ item: uni.item.Item; plain?: boolean }>()

const createFavouriteCard = useTemplateRef('createFavouriteCard')
const selectList = shallowReactive(new Set<FavouriteDB.Card['createAt']>())

const { state: allFavouriteCards } = FavouriteDB.useQueryCard(
  db => db.selectAll().execute(),
  [],
  () => []
)

const getCardCount = (createAt: FavouriteDB.Card['createAt']) =>
  FavouriteDB.useQueryItem(
    db => DBUtils.countDb(db.where('belongTo', '=', createAt)),
    [createAt],
    () => 0
  )

const isShow = shallowRef(false)
const $message = useMessage()

let promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()

const create = async () => {
  console.log('create popup for favselect')
  promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()
  if (isShow.value) {
    $message.warning('正在选择中')
    promise.reject()
    return promise.promise
  }
  selectList.clear()
  console.log('favselect getting data')
  const items = await db
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

const { upsert: upsertItem } = FavouriteDB.useUpsertItem()

const favouriteThis = (inCard: FavouriteDB.Card['createAt'][]) =>
  DBUtils.withTransition(trx =>
    Promise.all(
      inCard.map(card =>
        upsertItem({
          item: $props.item,
          belongTos: [card],
          trx
        })
      )
    )
  )

const { data: thisFavouriteCount } = FavouriteDB.useQueryItem(db =>
  DBUtils.countDb(db.where('itemKey', '=', $props.item.id))
)
</script>

<template>
  <DcToggleIcon
    padding
    :size="plain ? '35px' : '27px'"
    @long-click="create().then(favouriteThis)"
    @click="favouriteThis([0])"
    :model-value="thisFavouriteCount > 0"
    :icon="plain ? Icons.material.StarOutlineRound : Icons.antd.StarFilled"
  >
    {{ plain ? '' : '收藏' }}
  </DcToggleIcon>
  <DcPopup
    v-model:show="isShow"
    position="bottom"
    round
    class="bg-(--van-background)!"
    @closed="promise.reject()"
  >
    <div class="relative m-(--van-cell-group-inset-padding) mt-2 mb-2! w-full font-semibold">
      选择收藏夹
      <div
        @click="createFavouriteCard?.create()"
        class="absolute top-1/2 right-8 flex -translate-y-1/2 items-center text-xs! font-normal text-(--van-text-color-2)"
      >
        <NIcon>
          <Icons.material.PlusFilled />
        </NIcon>
        新建收藏夹
      </div>
    </div>
    <VanCellGroup inset class="mb-6!">
      <DcState
        contentClass="h-fit w-full"
        :state="allFavouriteCards"
        class="h-fit! w-full!"
        v-slot="{ data }"
        ><DcVar
          v-for="card of data"
          v-slot="{ value: count }"
          :value="getCardCount(card.createAt).data.value"
        >
          <VanCell
            center
            :title="card.title"
            :label="`${count}个内容`"
            clickable
            @click="
              selectList.has(card.createAt)
                ? selectList.delete(card.createAt)
                : selectList.add(card.createAt)
            "
          >
            <template #right-icon>
              <NCheckbox :checked="selectList.has(card.createAt)" />
            </template>
          </VanCell>
        </DcVar>
      </DcState>
    </VanCellGroup>
    <NButton class="m-5! w-30!" @click="submit" strong secondary type="primary" size="large">
      确定
    </NButton>
  </DcPopup>
  <CreateFavouriteCard ref="createFavouriteCard" />
</template>