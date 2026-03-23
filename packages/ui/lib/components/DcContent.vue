<script setup lang="ts" generic="T">
import type { UseQueryReturn } from '@pinia/colada'
import { omit } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { motion, type VariantType } from 'motion-v'
import { twMerge, type ClassNameValue } from 'tailwind-merge'
import { type StyleValue, computed, useTemplateRef } from 'vue'

import type { StyleProps } from '@/utils'

import DcLoading from './DcLoading.vue'
import { ReloadOutlined, WifiTetheringErrorRound } from './icons'
const $props = defineProps<
  {
    hideError?: boolean
    hideEmpty?: boolean
    hideLoading?: boolean
    source:
      | {
          type: 'query'
          query: UseQueryReturn<T>
        }
      | {
          type: 'raw'
          data: T
          isLoading: boolean
          error?: Error | null
          refetch?: () => any
        }
    classError?: ClassNameValue
    classEmpty?: ClassNameValue
    styleError?: StyleValue
    styleEmpty?: StyleValue
  } & StyleProps
>()


const source = computed(() =>
  $props.source.type == 'query'
    ? {
        data: $props.source.query.data.value,
        isLoading: $props.source.query.isLoading.value,
        error: $props.source.query.error.value,
        refetch() {
          if ($props.source.type != 'query') return $props.source.refetch?.()
          return $props.source.query.refetch(false)
        }
      }
    : omit($props.source, ['type'])
)


type AllVariant =
  | 'isLoadingNoData'
  | 'isErrorNoData'
  | 'isLoadingData'
  | 'isErrorData'
  | 'isEmpty'
  | 'done'
const loadingVariants = computed<Record<AllVariant, VariantType>>(() => ({
  isLoadingNoData: {
    opacity: 1,
    translateY: 0,
    width: '2.5rem',
    height: '2.5rem',
    paddingBlock: '2px',
    paddingInline: '2px',
    left: '50%',
    top: '8px',
    translateX: '-50%',
    backgroundColor: 'var(--van-background-2)',
    borderRadius: '100%'
  },
  isErrorNoData: {
    opacity: 1,
    translateY: '-50%',
    width: '70%',
    minHeight: source.value.refetch ? '22rem' : '20rem',
    paddingBlock: '2px',
    paddingInline: '2px',
    left: '50%',
    top: '50%',
    translateX: '-50%',
    backgroundColor: 'var(--van-background-2)',
    borderRadius: '4px'
  },
  isLoadingData: {
    opacity: 0.7,
    translateY: '0%',
    width: '4rem',
    height: '1.3rem',
    paddingBlock: '2px',
    paddingInline: '8px',
    left: '4px',
    top: 'calc(100% - 8px - 1rem)',
    translateX: '0%',
    backgroundColor: 'var(--p-color)',
    borderRadius: '1.3rem'
  },
  isErrorData: {
    opacity: 0.7,
    translateY: '0%',
    width: 'fit-content',
    height: '4rem',
    paddingBlock: '2px',
    paddingInline: '8px',
    left: '4px',
    top: 'calc(100% - 8px - 4rem)',
    translateX: '0%',
    backgroundColor: 'var(--p-color)',
    borderRadius: '4px'
  },
  isEmpty: {
    opacity: 1,
    translateY: '-50%',
    width: '90%',
    height: '10rem',
    paddingBlock: '2px',
    paddingInline: '2px',
    left: '50%',
    top: '50%',
    translateX: '-50%',
    backgroundColor: 'var(--van-background-2)',
    borderRadius: '4px'
  },
  done: {
    width: '4rem',
    height: '1.3rem',
    opacity: 0,
    translateY: '100%',
    paddingBlock: '0px',
    paddingInline: '0px',
    left: '4px',
    top: 'calc(100% - 8px - 1rem)',
    translateX: '0%',
    backgroundColor: 'var(--p-color)',
    borderRadius: '4px'
  }
}))
const animateOn = computed<AllVariant>(() => {
  if (!$props.hideLoading && source.value.isLoading) {
    if (isEmpty(source.value.data)) return 'isLoadingNoData'
    else return 'isLoadingData'
  } else if (!$props.hideError && source.value.error) {
    if (isEmpty(source.value.data)) return 'isErrorNoData'
    else return 'isErrorData'
  } else if (!$props.hideEmpty && isEmpty(source.value.data)) {
    return 'isEmpty'
  }
  return 'done'
})


const conation = useTemplateRef('conation')
defineExpose({ cont: conation })
defineSlots<{ default(data: { data?: T }): any }>()
</script>

<template>
  <div class="relative size-full overflow-hidden">
    <div :class="twMerge('relative size-full', $props.class)" ref="conation">
      <slot v-if="!isEmpty(source.data)" :data="source.data" />
    </div>
    <AnimatePresence>
      <motion.div
        :initial="{ opacity: 0, translateY: '-100%', left: '50%', translateX: '-50%' }"
        :variants="loadingVariants"
        :animate="animateOn"
        class="absolute flex scale-100 items-center justify-center whitespace-nowrap shadow"
      >
        <Transition name="van-fade">
          <VanLoading size="25px" color="var(--p-color)" v-if="animateOn === 'isLoadingNoData'" />
          <DcLoading size="10px" color="white" v-else-if="animateOn === 'isLoadingData'"
            >加载中</DcLoading
          >
          <div v-else-if="animateOn === 'isEmpty'">
            <NEmpty
              description="无结果"
              :class="twMerge('w-full justify-center!', classEmpty)"
              :style="[style, styleEmpty]"
            />
          </div>
          <div v-else-if="animateOn === 'isErrorNoData'" class="size-full">
            <NResult
              status="error"
              title="网络错误"
              :class="
                twMerge(
                  'flex size-full! flex-col items-center! justify-center! text-wrap *:w-full',
                  classError
                )
              "
              :style="[style, styleError]"
              :description="source.error?.message ?? '未知原因'"
            >
              <template #footer>
                <NButton v-if="source.refetch" @click="source.refetch()" type="primary"
                  >重试</NButton
                >
              </template>
              <template #icon>
                <NIcon size="10rem" color="var(--nui-error-color)">
                  <WifiTetheringErrorRound />
                </NIcon>
              </template>
            </NResult>
          </div>
          <div
            v-else-if="animateOn === 'isErrorData'"
            class="flex items-center justify-around gap-3"
          >
            <NIcon size="3rem" color="white">
              <WifiTetheringErrorRound />
            </NIcon>
            <div class="flex flex-col justify-center gap-2 text-white">
              <div class="text-sm">网络错误</div>
              <div class="text-xs text-wrap">{{ source.error?.message ?? '未知原因' }}</div>
            </div>
            <NButton
              circle
              type="error"
              size="large"
              v-if="source.refetch"
              @click="source.refetch()"
            >
              <template #icon>
                <NIcon color="white">
                  <ReloadOutlined />
                </NIcon>
              </template>
            </NButton>
          </div>
        </Transition>
      </motion.div>
    </AnimatePresence>
  </div>
</template>