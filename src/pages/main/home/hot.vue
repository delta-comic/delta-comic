<script setup lang='ts'>
import { Comp, coreModule, requireDepend, uni } from 'delta-comic-core'
import LevelIcon from './icon.vue'
import { isEmpty } from 'es-toolkit/compat'
import { computed } from 'vue'
import { ArrowForwardIosRound } from '@vicons/material'
import { chunk } from 'es-toolkit'

const hotList = computed(() => Array.from(uni.content.ContentPage.mainLists.values()))

const { comp } = requireDepend(coreModule)
const getItemCard = (contentType: uni.content.ContentType_) => uni.item.Item.itemCard.get(contentType) ?? comp.ItemCard

</script>

<template>
  <NScrollbar class="size-full">
    <div class="w-full h-fit overflow-y-hidden overflow-x-auto scrollbar py-1 bg-(--van-background-2) flex gap-8 px-4">
      <div class="h-full flex flex-col w-fit items-center justify-around" v-for="btn of [isEmpty(uni.content.ContentPage.levelboard) ? undefined : {
        bgColor: '#ff9212',
        name: '排行榜',
        icon: LevelIcon,
        onClick() {
          const first = uni.content.ContentPage.levelboard.keys().next().value!
          return $router.force.push(`/hot?plugin=${first}`)
        }
      }, ...Array.from(uni.content.ContentPage.topButton.values()).flat()].filter(v => !!v)">
        <button class="size-12  rounded-full flex items-center justify-center" :style="{ backgroundColor: btn.bgColor }"
          @click="btn.onClick">
          <NIcon color="white" size="calc(var(--spacing) * 6.5)">
            <component :is="btn.icon" />
          </NIcon>
        </button>
        <div class="!text-[13px]">{{ btn.name }}</div>
      </div>
    </div>
    <div v-for="block of hotList.flat()">
      <VanSticky>
        <div class="w-[calc(100%-8px)] mx-auto relative flex items-center my-1 h-10 bg-(--van-background-2) rounded"
          @click="block.onClick">
          <span class="ml-3 text-(--nui-primary-color) text-xl font-bold">{{ block.name }}</span>
          <NIcon class="!absolute right-3" color="var(--van-text-color-3)" size="20px">
            <ArrowForwardIosRound />
          </NIcon>
        </div>
      </VanSticky>
      <Comp.Var :value="block.content()" v-slot="{ value }">
        <Comp.Content :source="value">
          <div class="flex gap-1 px-1">
            <div class="flex gap-1 flex-col w-full"
              v-for="items of chunk(value.data.value ?? [], Math.floor((value.data.value ?? []).length / 2))">
              <component v-for="item of items" :item free-height type="small" :is="getItemCard(item.contentType)" />
            </div>
          </div>
        </Comp.Content>

      </Comp.Var>
    </div>
  </NScrollbar>
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