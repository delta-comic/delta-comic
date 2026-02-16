<script setup lang="ts">
import { ArrowForwardIosRound } from '@vicons/material'
import { computed, shallowRef } from 'vue'
import AuthorList from '@/components/subscribe/subAuthorList.vue'
import AuthorIcon from '@/components/user/authorIcon.vue'
import { computedAsync } from '@vueuse/core'
import { SubscribeDB } from '@delta-comic/db'
import { DcPopup, DcVar } from '@delta-comic/ui'
const isOnAllPage = shallowRef(true)
const subscribe = computedAsync(() => SubscribeDB.getAll(), [])

const select = shallowRef<string>()
const selectItem = computed(() => subscribe.value.find(v => v.key == select.value))

const isShowAllList = shallowRef(false)
</script>

<template>
  <div class="relative flex size-full flex-col pt-safe">
    <div class="h-fit w-full transition-all will-change-transform"
      :class="[!!select ? '-translate-y-1/3 opacity-0' : 'translate-y-0 opacity-100']">
      <!-- nav -->
      <div
        class="van-hairline--bottom relative flex h-12 w-full items-end justify-center bg-(--van-background-2) pt-safe text-lg font-semibold">
        <span class="pb-1">关注</span>
      </div>
      <!-- tab -->
      <div class="flex h-fit w-full justify-around bg-(--van-background-2) py-1 text-nowrap">
        <NButton tertiary :type="isOnAllPage ? 'primary' : 'tertiary'" size="tiny" class="w-[calc(50%-5px)]!"
          @click="isOnAllPage = true">
          全部
        </NButton>
        <NButton tertiary :type="isOnAllPage ? 'tertiary' : 'primary'" size="tiny" class="w-[calc(50%-5px)]!"
          @click="isOnAllPage = false">
          追更
        </NButton>
      </div>
      <!-- more -->
      <div class="relative flex w-full items-center bg-(--van-background-2) pt-3 pb-3 text-nowrap"
        @click="isShowAllList = true">
        <div class="ml-3 h-fit font-semibold">最常访问</div>
        <div class="absolute top-safe-offset-3 right-3 flex items-center text-xs text-(--van-text-color-2)">
          更多
          <NIcon>
            <ArrowForwardIosRound />
          </NIcon>
        </div>
      </div>
      <!-- authors -->
      <div
        class="scrollbar flex h-fit w-full gap-1 overflow-x-auto overflow-y-hidden bg-(--van-background-2) px-1 py-1">
        <div v-for="sub of subscribe" class="flex h-full w-fit flex-col items-center justify-around"
          @click="select = sub.key">
          <template v-if="sub.type == 'author'">
            <AuthorIcon :size-spacing="12" :author="sub.author" />
            <div class="van-multi-ellipsis--l2 mt-1 w-18 text-center text-xs text-wrap text-(--van-text-color-2)">
              {{ sub.author.label }}
            </div>
          </template>
        </div>
      </div>
    </div>
    <!-- list -->
    <div class="flex min-h-0 w-full flex-1 items-center justify-center">
      <NEmpty size="huge"> 选择任意一项以查看内容 </NEmpty>
    </div>
    <AuthorList v-model:select="select" :select-item v-if="selectItem?.type == 'author'" />
  </div>
  <DcPopup v-model:show="isShowAllList" position="bottom" round class="h-[70vh]">
    <div v-for="sub of subscribe" class="van-hairline--bottom relative w-full py-2" @click="
      () => {
        isShowAllList = false
        select = sub.key
      }
    ">
      <DcVar :value="sub.author" v-if="sub.type == 'author'" v-slot="{ value: author }">
        <div class="van-ellipsis flex w-fit items-center pl-2 text-[16px] text-(--p-color)">
          <AuthorIcon :size-spacing="8.5" :author class="mx-2" />
          <div class="flex w-full flex-col text-nowrap">
            <div class="flex items-center text-(--nui-primary-color)">
              {{ author.label }}
            </div>
            <div class="-mt-0.5 flex max-w-2/3 items-center text-[11px] text-(--van-text-color-2)">
              {{ author.description }}
            </div>
          </div>
        </div>
      </DcVar>
    </div>
  </DcPopup>
</template>
<style scoped lang="css">
.scrollbar::-webkit-scrollbar {
  display: none;
}

.scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>