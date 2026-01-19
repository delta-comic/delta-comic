<script setup lang='ts' generic="T">
import { createReusableTemplate } from '@vueuse/core'
import { Store } from 'delta-comic-core'
import { motion } from 'motion-v'
import { PopoverAction } from 'vant'
import { shallowRef, shallowReactive } from 'vue'

const $props = defineProps<{
  values: T[]
  action: (PopoverAction & { onTrigger: (sel: T[]) => void })[]
}>()

const [DefineSelectPacker, SelectPacker] = createReusableTemplate<{
  it: T
}>()

const showSelect = shallowRef(false)
const selectList = shallowReactive(new Set<T>())
const cancel = () => {
  showSelect.value = false
  selectList.clear()
}
const selectAll = () => {
  selectList.clear()
  for (const item of $props.values) selectList.add(item)
}

const [DefineActionBar, ActionBar] = createReusableTemplate()
defineSlots<{
  default(arg: { ActionBar: typeof ActionBar, SelectPacker: typeof SelectPacker }): any
}>()
defineExpose({
  showSelect,
  selectList
})

const config = Store.useConfig()
</script>

<template>
  <DefineSelectPacker v-slot="{ $slots, it: item }">
    <div class="w-full relative">
      <component :is="$slots.default" />
      <AnimatePresence>
        <motion.div @click="showSelect && (selectList.has(item) ? selectList.delete(item) : selectList.add(item))"
          v-if="showSelect" class="w-full h-full absolute top-0 left-0" :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
          <div class="flex justify-center items-center absolute top-0 right-0 h-full w-15">
            <motion.div v-if="showSelect && selectList.has(item)" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
              :exit="{ opacity: 0 }"
              class="absolute top-0 right-0 h-full w-15 bg-[linear-gradient(to_left,_var(--p-color),_transparent)]">
            </motion.div>
            <Motion :initial="{ translateX: '100%' }" :animate="{ translateX: '0%' }" :exit="{ translateX: '100%' }"
              v-if="showSelect">
              <VanCheckbox :model-value="selectList.has(item)" class="bg-(--van-background-2) z-1 rounded-full" />
            </Motion>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  </DefineSelectPacker>
  <DefineActionBar>
    <AnimatePresence>
      <motion.div v-if="showSelect"
        class="shadow-lg w-[95%] h-11 overflow-hidden fixed font-normal text-normal flex items-center z-2 top-safe-offset-12 left-1/2 -translate-x-1/2 bg-(--van-background-2) rounded-lg"
        :initial="{ translateY: '-100%', opacity: 0 }" :animate="{ translateY: '0%', opacity: 1 }"
        :exit="{ translateY: '-100%', opacity: 0 }">
        <div class="ml-2 w-full flex items-center">
          <span class="bg-(--van-gray-1) px-1.5 text-[16px] rounded" :class="[config.isDark && '!bg-white/10']">
            已选<span class="text-(--p-color) px-0.5">{{ selectList.size }}</span>项
          </span>
        </div>
        <div class="flex text-nowrap items-center">
          <NButton class="!h-11" quaternary @click="selectAll()">全选</NButton>
          <VanButton square type="warning" @click="cancel()">取消</VanButton>
          <VanPopover :actions="action" @select="(q: { onTrigger: Function }) => q.onTrigger([...selectList])"
            placement="bottom-end">
            <template #reference>
              <VanButton square type="primary">操作</VanButton>
            </template>
          </VanPopover>
        </div>
      </motion.div>
    </AnimatePresence>
  </DefineActionBar>
  <slot :ActionBar :SelectPacker />
</template>