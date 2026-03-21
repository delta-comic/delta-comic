<script setup lang="ts">
import { DBUtils, FavouriteDB } from '@delta-comic/db'
import { DcState } from '@delta-comic/ui'
import { useMessage } from 'naive-ui'
import { useTemplateRef, shallowRef, shallowReactive } from 'vue'

import { Icons } from '@/icons'

const createFavouriteCard = useTemplateRef('createFavouriteCard')
const selectList = shallowReactive(new Set<FavouriteDB.Card['createAt']>())


const { state: allFavouriteCards } = FavouriteDB.useQueryCard(
  db => db.selectAll().execute(),
  [],
  () => []
)


const getCardItemCount = (belongTo: FavouriteDB.Card['createAt']) =>
  FavouriteDB.useQueryItem(
    db => DBUtils.countDb(db.where('belongTo', '=', belongTo)),
    [belongTo],
    () => -1
  )


const isShow = shallowRef(false)
const $message = useMessage()


let promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()


const create = () => {
  promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()
  if (isShow.value) {
    $message.warning('正在选择中')
    promise.reject()
    return promise.promise
  }
  selectList.clear()
  isShow.value = true
  return promise.promise
}
const submit = () => {
  if (selectList.size === 0) {
    return $message.warning('不可为空')
  }
  promise.resolve([...selectList])
  selectList.clear()
  isShow.value = false
}
defineExpose({ create })
</script>

<template>
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
        :state="allFavouriteCards"
        v-slot="{ data: afc }"
        class="h-fit!"
        contentClass="h-fit!"
      >
        <DcState
          v-for="card of afc"
          v-slot="{ data: count }"
          :state="getCardItemCount(card.createAt).state.value"
          class="size-fit"
          contentClass="size-fit"
        >
          <VanCell
            center
            :title="card.title"
            :label="`${count ?? 0}个内容`"
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
        </DcState>
      </DcState>
    </VanCellGroup>
    <NButton class="m-5! w-30!" @click="submit" strong secondary type="primary" size="large">
      确定
    </NButton>
  </DcPopup>
  <CreateFavouriteCard ref="createFavouriteCard" />
</template>