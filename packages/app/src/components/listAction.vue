<script setup lang="ts" generic="T">
import { useConfig } from '@delta-comic/plugin'
import { createReusableTemplate } from '@vueuse/core'
import { motion } from 'motion-v'
import { NButton, NCheckbox, NDropdown, type DropdownOption } from 'naive-ui'
import { computed, shallowRef, shallowReactive } from 'vue'
import { useI18n } from 'vue-i18n'

export interface ListActionOption<T> {
  text: string
  icon?: string
  color?: string
  disabled?: boolean
  className?: string
  onTrigger: (selected: T[]) => void
}

const $props = defineProps<{ values: T[]; action: ListActionOption<T>[] }>()

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

const actionOptions = computed<DropdownOption[]>(() =>
  $props.action.map((action, index) => ({
    key: index,
    label: action.text,
    disabled: action.disabled,
    props: { class: action.className, style: action.color ? { color: action.color } : undefined },
  })),
)

const triggerAction = (key: string | number) => {
  $props.action[Number(key)]?.onTrigger([...selectList])
}

const [DefineActionBar, ActionBar] = createReusableTemplate()
defineSlots<{
  default(arg: { ActionBar: typeof ActionBar; SelectPacker: typeof SelectPacker }): any
}>()
defineExpose({ showSelect, selectList })

const config = useConfig()
const { t } = useI18n()
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
              <NCheckbox
                :checked="selectList.has(item)"
                class="z-1 rounded-full bg-(--dc-background-2)"
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
        class="text-normal fixed top-safe-offset-12 left-1/2 z-2 flex h-11 w-[95%] -translate-x-1/2 items-center overflow-hidden rounded-lg bg-(--dc-background-2) font-normal shadow-lg"
        :initial="{ translateY: '-100%', opacity: 0 }"
        :animate="{ translateY: '0%', opacity: 1 }"
        :exit="{ translateY: '-100%', opacity: 0 }"
      >
        <div class="ml-2 flex w-full items-center">
          <span
            class="rounded bg-(--dc-gray-1) px-1.5 text-[16px]"
            :class="[config.isDark && 'bg-white/10!']"
          >
            {{ t('common.selection.selectedPrefix')
            }}<span class="px-0.5 text-(--p-color)">{{ selectList.size }}</span
            >{{ t('common.selection.selectedSuffix') }}
          </span>
        </div>
        <div class="flex items-center text-nowrap">
          <NButton class="h-11!" quaternary @click="selectAll()">
            {{ t('common.actions.selectAll') }}
          </NButton>
          <NButton class="h-11! rounded-none!" type="warning" @click="cancel()">
            {{ t('common.actions.cancel') }}
          </NButton>
          <NDropdown
            trigger="click"
            :options="actionOptions"
            @select="triggerAction"
            placement="bottom-end"
          >
            <NButton class="h-11! rounded-none!" type="primary">
              {{ t('common.actions.actions') }}
            </NButton>
          </NDropdown>
        </div>
      </motion.div>
    </AnimatePresence>
  </DefineActionBar>
  <slot :ActionBar :SelectPacker />
</template>