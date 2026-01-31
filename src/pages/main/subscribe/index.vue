<script setup lang='ts'>
import { SubscribeDB } from '@/db/subscribe'
import { ArrowForwardIosRound } from '@vicons/material'
import { computed, shallowRef } from 'vue'
import AuthorList from '@/components/subscribe/subAuthorList.vue'
import AuthorIcon from '@/components/user/authorIcon.vue'
import { Comp } from 'delta-comic-core'
import { computedAsync } from '@vueuse/core'
const isOnAllPage = shallowRef(true)
const subscribe = computedAsync(() => SubscribeDB.getAll(), [])

const select = shallowRef<string>()
const selectItem = computed(() => subscribe.value.find(v => v.key == select.value))


const isShowAllList = shallowRef(false)
</script>

<template>
  <div class="size-full flex flex-col relative pt-safe">
    <div class="w-full h-fit transition-all will-change-transform"
      :class="[!!select ? '-translate-y-1/3 opacity-0' : 'translate-y-0 opacity-100']">
      <!-- nav -->
      <div
        class="w-full pt-safe relative flex justify-center h-12 text-lg font-semibold items-end van-hairline--bottom bg-(--van-background-2)">
        <span class="pb-1">关注</span>
      </div>
      <!-- tab -->
      <div class="w-full text-nowrap flex justify-around bg-(--van-background-2) h-fit py-1">
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
      <div class="w-full text-nowrap flex items-center bg-(--van-background-2) pb-3 pt-3 relative"
        @click="isShowAllList = true">
        <div class="font-semibold ml-3 h-fit">最常访问</div>
        <div class="flex items-center text-(--van-text-color-2) absolute right-3 text-xs top-safe-offset-3">
          更多
          <NIcon>
            <ArrowForwardIosRound />
          </NIcon>
        </div>
      </div>
      <!-- authors -->
      <div
        class="w-full h-fit overflow-y-hidden overflow-x-auto scrollbar py-1 bg-(--van-background-2) flex gap-1 px-1">
        <div v-for="sub of subscribe" class="h-full flex flex-col w-fit items-center justify-around"
          @click="select = sub.key">
          <template v-if="sub.type == 'author'">
            <AuthorIcon :size-spacing="12" :author="sub.author" />
            <div class="text-wrap w-18 text-xs mt-1 text-center text-(--van-text-color-2) van-multi-ellipsis--l2">
              {{ sub.author.label }}
            </div>
          </template>
        </div>
      </div>
    </div>
    <!-- list -->
    <div class="flex-1 w-full min-h-0 flex justify-center items-center">
      <NEmpty size="huge">
        选择任意一项以查看内容
      </NEmpty>
    </div>
    <AuthorList v-model:select="select" :select-item v-if="selectItem?.type == 'author'" />
  </div>
  <Comp.Popup v-model:show="isShowAllList" position="bottom" round class="h-[70vh]">
    <div v-for="sub of subscribe" class="relative w-full py-2 van-hairline--bottom" @click="() => {
      isShowAllList = false
      select = sub.key
    }">
      <Comp.Var :value="sub.author" v-if="sub.type == 'author'" v-slot="{ value: author }">
        <div class="van-ellipsis w-fit text-(--p-color) text-[16px] flex items-center pl-2">
          <AuthorIcon :size-spacing="8.5" :author class="mx-2" />
          <div class="flex flex-col w-full text-nowrap">
            <div class="text-(--nui-primary-color) flex items-center">
              {{ author.label }}
            </div>
            <div class="-mt-0.5 max-w-2/3 text-(--van-text-color-2) text-[11px] flex items-center">
              {{ author.description }}
            </div>
          </div>
        </div>
      </Comp.Var>
    </div>
  </Comp.Popup>
</template>
<style scoped lang='css'>
.scrollbar::-webkit-scrollbar {
  display: none;
}

.scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>