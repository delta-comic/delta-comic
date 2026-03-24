<script setup lang="ts">
import { SubscribeDB } from '@delta-comic/db'
import { usePreventBack, DcState, useZIndex } from '@delta-comic/ui'
import { motion } from 'motion-v'
import { computed } from 'vue'

import { Icons } from '@/icons'

import SubList from './subList.vue'

const props = defineProps<{ selectItem: SubscribeDB.AuthorItem }>()
const select = defineModel<string | undefined>('select', { required: true })


const { state: subscribe } = SubscribeDB.useQuery(db => db.selectAll().execute())


const { remove } = SubscribeDB.useRemove()
const unsubscribe = (si: SubscribeDB.Item) => {
  select.value = undefined
  return remove({ keys: [si.key] })
}


const isShow = computed({
  get() {
    return !!select.value
  },
  set(v) {
    if (!v) select.value = undefined
  }
})
const [, isLast] = useZIndex(isShow)
usePreventBack(isShow, isLast)
</script>

<template>
  <AnimatePresence>
    <div class="absolute top-safe left-0 h-15 w-full" @click="select = undefined">
      <DcState :state="subscribe" v-slot="{ data }">
        <template v-for="sub of data">
          <motion.div
            v-if="sub.key == select"
            :initial="{ scale: '80%', translateX: '-50%', opacity: 0 }"
            :exit="{ scale: '80%', translateX: '-50%', opacity: 0 }"
            :animate="{ scale: '100%', translateX: '0%', opacity: 1 }"
            class="van-ellipsis absolute top-1 left-1 flex h-[calc(60px-(var(--spacing)*2))] w-fit max-w-[calc(100%-8px)] items-center gap-2 rounded-2xl bg-(--van-background-2) px-3 text-nowrap"
          >
            <DcAuthorIcon :size-spacing="10" :author="selectItem.author" />
            <div class="text-lg font-semibold text-(--p-color)">{{ selectItem.author.label }}</div>
          </motion.div>
        </template>
      </DcState>
    </div>
    <motion.div
      class="absolute top-safe-offset-[60px] left-0 h-[calc(100%-60px)] w-full bg-(--van-background-2)"
      v-if="selectItem"
      :initial="{ translateY: '-30px', opacity: 0 }"
      :exit="{ translateY: '-30px', opacity: 0 }"
      :animate="{ translateY: '0px', opacity: 1 }"
      drag="y"
      :dragConstraints="{ top: 0, right: 0, bottom: 0, left: 0 }"
      :dragTransition="{ bounceStiffness: 500, bounceDamping: 15 }"
      @drag-end="(_, info) => info.offset.y > 100 && (select = undefined)"
    >
      <DcState :state="subscribe" v-slot="{ data: subs }">
        <VanTabs
          swipeable
          :show-header="false"
          class="size-full! *:*:*:size-full! *:*:size-full! *:size-full!"
          v-model:active="select"
        >
          <VanTab
            class="size-full! *:size-full!"
            v-for="author of <SubscribeDB.AuthorItem[]>subs.filter(v => v.type == 'author')"
            :name="author.key"
          >
            <div
              class="van-hairline--bottom relative flex h-10 w-full items-center rounded-t-2xl bg-(--van-background-2) pl-3 text-base font-semibold"
            >
              {{ author.author.label }}的动态
              <NIcon
                size="25px"
                color="var(--van-text-color-3)"
                class="absolute! right-1"
                @click="select = undefined"
              >
                <Icons.material.CloseRound />
              </NIcon>
            </div>
            <div @pointerdown.stop class="h-[calc(100%-40px)] w-full overflow-hidden">
              <SubList @unsubscribe="unsubscribe(author)" :source="author" />
            </div>
          </VanTab>
        </VanTabs>
      </DcState>
    </motion.div>
  </AnimatePresence>
</template>