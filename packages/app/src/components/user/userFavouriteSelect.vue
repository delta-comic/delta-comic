<script setup lang="ts">
import { DBUtils, FavouriteDB } from '@delta-comic/db'
import { DcState } from '@delta-comic/ui'
import { useMessage } from 'naive-ui'
import { useTemplateRef, shallowRef, shallowReactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

const createFavouriteCard = useTemplateRef('createFavouriteCard')
const selectList = shallowReactive(new Set<FavouriteDB.Card['createAt']>())

const { state: allFavouriteCards } = FavouriteDB.useQueryCard(
  db => db.selectAll().execute(),
  [],
  () => [],
)

const getCardItemCount = (belongTo: FavouriteDB.Card['createAt']) =>
  FavouriteDB.useQueryItem(
    db => DBUtils.countDb(db.where('belongTo', '=', belongTo)),
    [belongTo],
    () => -1,
  )

const isShow = shallowRef(false)
const $message = useMessage()
const { t } = useI18n()

let promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()

const create = () => {
  promise = Promise.withResolvers<FavouriteDB.Card['createAt'][]>()
  if (isShow.value) {
    $message.warning(t('common.feedback.selecting'))
    promise.reject()
    return promise.promise
  }
  selectList.clear()
  isShow.value = true
  return promise.promise
}
const submit = () => {
  if (selectList.size === 0) {
    return $message.warning(t('common.validation.selectionRequired'))
  }
  promise.resolve([...selectList])
  selectList.clear()
  isShow.value = false
}
defineExpose({ create })
</script>

<template>
  <NDrawer v-model:show="isShow" placement="bottom" @afterLeave="promise.reject()">
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
          <DcCell
            center
            :title="card.title"
            :label="t('common.units.contentCount', { count: count ?? 0 })"
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
        </DcState>
      </DcState>
    </DcCellGroup>
    <NButton class="m-5! w-30!" @click="submit" strong secondary type="primary" size="large">
      {{ t('common.actions.confirm') }}
    </NButton>
  </NDrawer>
  <CreateFavouriteCard ref="createFavouriteCard" />
</template>