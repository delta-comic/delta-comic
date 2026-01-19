<script setup lang='ts'>
import { Comp, Store, uni, Utils } from 'delta-comic-core'
import Card from './card.vue'
import { SubscribeDB } from '@/db/subscribe'
import { motion } from 'motion-v'
import { usePluginStore } from '@/plugin/store'
import { CloseRound } from '@vicons/material'
import { onBeforeRouteLeave } from 'vue-router'
import AuthorIcon from '@/components/user/authorIcon.vue'
import { db } from '@/db'
import { computedAsync } from '@vueuse/core'

defineProps<{
  selectItem: SubscribeDB.AuthorItem
}>()
const select = defineModel<string | undefined>('select', { required: true })

const pluginStore = usePluginStore()
const subscribe = computedAsync(() => SubscribeDB.getAll(), [])

const temp = Store.useTemp().$applyRaw('subscribeList', () => new Map<string, Utils.data.RStream<uni.item.Item>>())
const getSource = (si: SubscribeDB.Item) => {
  // select.value ? (temp[select.value.key] ??=   []) : undefined
  if (temp.has(si.key)) return temp.get(si.key)!
  const [plugin] = SubscribeDB.key.toJSON(si.key)
  if (si.type == 'author') {
    const type = si.author.subscribe!
    const sub = pluginStore.plugins.get(plugin)?.subscribe?.[type]
    if (!sub) throw new Error(`can not found subscribe config which type:${type}, plugin:${plugin}`)
    const stream = sub.getListStream(si.author)
    temp.set(si.key, stream)
    return stream
  }
  throw new Error('not impl')
}

const unsubscribe = (si: SubscribeDB.Item) => {
  select.value = undefined
  return db.value.deleteFrom('subscribe').where('key', '=', si.key).execute()
}
onBeforeRouteLeave(() => {
  if (select.value) {
    select.value = undefined
    return false
  }
})
</script>

<template>
  <AnimatePresence>
    <div class="absolute top-safe left-0 h-15 w-full" @click="select = undefined">
      <template v-for="sub of subscribe">
        <motion.div v-if="sub.key == select" :initial="{ scale: '80%', translateX: '-50%', opacity: 0 }"
          :exit="{ scale: '80%', translateX: '-50%', opacity: 0 }"
          :animate="{ scale: '100%', translateX: '0%', opacity: 1 }"
          class="absolute top-1 h-[calc(60px-(var(--spacing)*2))] max-w-[calc(100%-8px)] text-nowrap van-ellipsis left-1 rounded-2xl bg-(--van-background-2) w-fit flex px-3 gap-2 items-center">
          <AuthorIcon :size-spacing="10" :author="selectItem.author" />
          <div class="text-lg text-(--p-color) font-semibold">{{ selectItem.author.label }}</div>
        </motion.div>
      </template>
    </div>
    <motion.div class="absolute top-safe-offset-[60px] left-0 w-full h-[calc(100%-60px)] bg-(--van-background-2)"
      v-if="selectItem" :initial="{ translateY: '-30px', opacity: 0 }" :exit="{ translateY: '-30px', opacity: 0 }"
      :animate="{ translateY: '0px', opacity: 1 }" drag="y" :dragConstraints="{ top: 0, right: 0, bottom: 0, left: 0 }"
      :dragTransition="{ bounceStiffness: 500, bounceDamping: 15 }"
      @drag-end="(_, info) => (info.offset.y > 100) && (select = undefined)">
      <VanTabs swipeable :show-header="false" class="size-full! *:size-full! *:*:size-full! *:*:*:size-full!"
        v-model:active="select">
        <VanTab class="size-full! *:size-full!" v-for="author of subscribe.filter(v => v.type == 'author')"
          :name="author.key">
          <div
            class="w-full h-10 font-semibold pl-3 text-base flex items-center van-hairline--bottom bg-(--van-background-2) relative rounded-t-2xl">
            {{ author.author.label }}的动态
            <NIcon size="25px" color="var(--van-text-color-3)" class="absolute! right-1" @click="select = undefined">
              <CloseRound />
            </NIcon>
          </div>
          <div @pointerdown.stop class="w-full h-[calc(100%-40px)] overflow-hidden">
            <Comp.Waterfall :source="getSource(author)" :padding="0" :col="1" :gap="4" v-slot="{ item }">
              <Card :item @unsubscribe="unsubscribe(author)" />
            </Comp.Waterfall>
          </div>
        </VanTab>
      </VanTabs>
    </motion.div>
  </AnimatePresence>
</template>