<script setup lang="ts">
import LevelIcon from '@/components/home/hotPageIcon.vue'
import { isEmpty } from 'es-toolkit/compat'
import { computed } from 'vue'
import { ArrowForwardIosRound } from '@vicons/material'
import { chunk } from 'es-toolkit'
import { Global } from '@delta-comic/plugin'
import { uni } from '@delta-comic/model'

const hotList = computed(() => Array.from(Global.mainLists.values()))

const getItemCard = (contentType: uni.content.ContentType_) =>
  uni.item.Item.itemCard.get(contentType)
</script>

<template>
  <NScrollbar class="size-full">
    <div class="scrollbar flex h-fit w-full gap-8 overflow-x-auto overflow-y-hidden bg-(--van-background-2) px-4 py-1">
      <div class="flex h-full w-fit flex-col items-center justify-around" v-for="btn of [
        isEmpty(Global.levelboard)
          ? undefined
          : {
            bgColor: '#ff9212',
            name: '排行榜',
            icon: LevelIcon,
            onClick() {
              const first = Global.levelboard.keys().next().value!
              return $router.force.push({ name: '/hot', query: { plugin: first } })
            }
          },
        ...Array.from(Global.topButton.values()).flat()
      ].filter(v => !!v)">
        <button class="flex size-12 items-center justify-center rounded-full" :style="{ backgroundColor: btn.bgColor }"
          @click="btn.onClick">
          <NIcon color="white" size="calc(var(--spacing) * 6.5)">
            <component :is="btn.icon" />
          </NIcon>
        </button>
        <div class="text-[13px]!">{{ btn.name }}</div>
      </div>
    </div>
    <div v-for="block of hotList.flat()">
      <VanSticky>
        <div class="relative mx-auto my-1 flex h-10 w-[calc(100%-8px)] items-center rounded bg-(--van-background-2)"
          @click="block.onClick">
          <span class="ml-3 text-xl font-bold text-(--nui-primary-color)">{{ block.name }}</span>
          <NIcon class="absolute! right-3" color="var(--van-text-color-3)" size="20px">
            <ArrowForwardIosRound />
          </NIcon>
        </div>
      </VanSticky>
      <DcVar :value="block.content()" v-slot="{ value }">
        <DcContent :source="value">
          <div class="flex gap-1 px-1">
            <div class="flex w-full flex-col gap-1" v-for="items of chunk(
              value.data.value ?? [],
              Math.floor((value.data.value ?? []).length / 2)
            )">
              <component v-for="item of items" :item free-height type="small" :is="getItemCard(item.contentType)" />
            </div>
          </div>
        </DcContent>
      </DcVar>
    </div>
  </NScrollbar>
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