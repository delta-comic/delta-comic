<script setup lang="ts">
import { db, DBUtils, FavouriteDB } from '@delta-comic/db'
import type { uni } from '@delta-comic/model'
import { DcToggleIcon, DcState } from '@delta-comic/ui'
import { useMessage } from 'naive-ui'
import { useTemplateRef, shallowRef, shallowReactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

const $props = defineProps<{ item: uni.item.Item; plain?: boolean }>()

const createFavouriteCard = useTemplateRef('createFavouriteCard')
const selectList = shallowReactive(new Set<FavouriteDB.Card['createAt']>())

const { state: allFavouriteCards } = FavouriteDB.useQueryCard(
  db => db.selectAll().execute(),
  [],
  () => [],
)

const getCardCount = (createAt: FavouriteDB.Card['createAt']) =>
  FavouriteDB.useQueryItem(
    db => DBUtils.countDb(db.where('belongTo', '=', createAt)),
    [createAt],
    () => 0,
  )

const isShow = shallowRef(false)
const $message = useMessage()
const { t } = useI18n()

let promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()

const create = async () => {
  console.log('create popup for favselect')
  promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()
  if (isShow.value) {
    $message.warning(t('common.feedback.selecting'))
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
    return $message.warning(t('common.validation.selectionRequired'))
  }
  promise.resolve([...selectList])
  selectList.clear()
  isShow.value = false
}

const { upsert: upsertItem } = FavouriteDB.useUpsertItem()

const favouriteThis = (inCard: FavouriteDB.Card['createAt'][]) =>
  DBUtils.withTransition(trx =>
    Promise.all(inCard.map(card => upsertItem({ item: $props.item, belongTos: [card], trx }))),
  )

const { data: thisFavouriteCount } = FavouriteDB.useQueryItem(db =>
  DBUtils.countDb(db.where('itemKey', '=', $props.item.id)),
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
    {{ plain ? '' : t('favourite.actions.favourite') }}
  </DcToggleIcon>
  <NDrawer v-model:show="isShow" placement="bottom" @closed="promise.reject()">
    <div class="relative m-(--dc-content-padding) mt-2 mb-2! w-full font-semibold">
      {{ t('favourite.select.title') }}
      <div
        @click="createFavouriteCard?.create()"
        class="absolute top-1/2 right-8 flex -translate-y-1/2 items-center text-xs! font-normal text-(--dc-text-secondary)"
      >
        <NIcon>
          <Icons.material.PlusFilled />
        </NIcon>
        {{ t('favourite.actions.newFolder') }}
      </div>
    </div>
    <DcCellGroup inset class="mb-6!">
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
          <DcCell
            center
            :title="card.title"
            :label="t('common.units.contentCount', { count })"
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
          </DcCell>
        </DcVar>
      </DcState>
    </DcCellGroup>
    <NButton class="m-5! w-30!" @click="submit" strong secondary type="primary" size="large">
      {{ t('common.actions.confirm') }}
    </NButton>
  </NDrawer>
  <CreateFavouriteCard ref="createFavouriteCard" />
</template>