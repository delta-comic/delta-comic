<script setup lang="ts" generic="T">
import { useConfig } from '@delta-comic/plugin'
import { createReusableTemplate } from '@vueuse/core'
import { motion } from 'motion-v'
import type { PopoverAction } from 'vant'
import { shallowRef, shallowReactive } from 'vue'

const $props = defineProps<{
  values: T[]
  action: (PopoverAction & { onTrigger: (sel: T[]) => void })[]
}>()

const [DefineSelectPacker, SelectPacker] = createReusableTemplate<{ it: T }>()

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
  default(arg: { ActionBar: typeof ActionBar; SelectPacker: typeof SelectPacker }): any
}>()
defineExpose({ showSelect, selectList })

const config = useConfig()
</script>

<template>
  <DefineSelectPacker v-slot="{ $slots, it: item }">
    <div class="relative w-full">
      <component :is="$slots.default" />
      <AnimatePresence>
        <motion.div
          @click="
            showSelect && (selectList.has(item) ? selectList.delete(item) : selectList.add(item))
          "
          v-if="showSelect"
          class="absolute top-0 left-0 h-full w-full"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
        >
          <div class="absolute top-0 right-0 flex h-full w-15 items-center justify-center">
            <motion.div
              v-if="showSelect && selectList.has(item)"
              :initial="{ opacity: 0 }"
              :animate="{ opacity: 1 }"
              :exit="{ opacity: 0 }"
              class="absolute top-0 right-0 h-full w-15 bg-[linear-gradient(to_left,var(--p-color),transparent)]"
            >
            </motion.div>
            <Motion
              :initial="{ translateX: '100%' }"
              :animate="{ translateX: '0%' }"
              :exit="{ translateX: '100%' }"
              v-if="showSelect"
            >
              <VanCheckbox
                :model-value="selectList.has(item)"
                class="z-1 rounded-full bg-(--van-background-2)"
              />
            </Motion>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  </DefineSelectPacker>
  <DefineActionBar>
    <AnimatePresence>
      <motion.div
        v-if="showSelect"
        class="text-normal fixed top-safe-offset-12 left-1/2 z-2 flex h-11 w-[95%] -translate-x-1/2 items-center overflow-hidden rounded-lg bg-(--van-background-2) font-normal shadow-lg"
        :initial="{ translateY: '-100%', opacity: 0 }"
        :animate="{ translateY: '0%', opacity: 1 }"
        :exit="{ translateY: '-100%', opacity: 0 }"
      >
        <div class="ml-2 flex w-full items-center">
          <span
            class="rounded bg-(--van-gray-1) px-1.5 text-[16px]"
            :class="[config.isDark && 'bg-white/10!']"
          >
            已选<span class="px-0.5 text-(--p-color)">{{ selectList.size }}</span
            >项
          </span>
        </div>
        <div class="flex items-center text-nowrap">
          <NButton class="h-11!" quaternary @click="selectAll()">全选</NButton>
          <VanButton square type="warning" @click="cancel()">取消</VanButton>
          <VanPopover
            :actions="action"
            @select="(q: { onTrigger: Function }) => q.onTrigger([...selectList])"
            placement="bottom-end"
          >
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