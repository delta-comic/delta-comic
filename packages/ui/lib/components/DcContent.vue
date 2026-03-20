<script setup lang="ts" generic="T">
import { PromiseContent, Stream } from '@delta-comic/model'
import { isEmpty } from 'es-toolkit/compat'
import { motion, type VariantType } from 'motion-v'
import { type StyleValue, computed, useTemplateRef } from 'vue'

import DcLoading from './DcLoading.vue'
import { ReloadOutlined, WifiTetheringErrorRound } from './icons'
const $props = defineProps<
  {
    retriable?: boolean
    hideError?: boolean
    hideEmpty?: boolean
    hideLoading?: boolean
    source: PromiseContent<any, T[]> | Stream<T> | T[] | T
  } & {
    class?: any
    classError?: any
    classEmpty?: any
    classLoading?: any
    style?: StyleValue
    styleError?: StyleValue
    styleEmpty?: StyleValue
    styleLoading?: StyleValue
  }
>()
defineSlots<{ default(data: { data?: T }): any }>()
defineEmits<{ retry: []; resetRetry: [] }>()
const unionSource = computed(() =>
  Stream.isStream($props.source)
    ? {
        isLoading: $props.source.isRequesting.value,
        isError: $props.source.error.value,
        errorCause: $props.source.error.value?.message,
        isEmpty: $props.source.isEmpty.value,
        data: <T>$props.source.data.value,
        isNoResult: $props.source.isNoData.value
      }
    : PromiseContent.isPromiseContent($props.source)
      ? {
          isLoading: $props.source.isLoading.value,
          isError: $props.source.isError.value,
          errorCause: $props.source.errorCause.value?.message,
          isEmpty: $props.source.isEmpty.value,
          data: <T>$props.source.data.value,
          isNoResult: $props.source.isEmpty.value
        }
      : {
          isLoading: false,
          isError: false,
          errorCause: undefined,
          isEmpty: isEmpty($props.source),
          data: <T>$props.source,
          isNoResult: isEmpty($props.source)
        }
)
type AllVariant =
  | 'isLoadingNoData'
  | 'isErrorNoData'
  | 'isLoadingData'
  | 'isErrorData'
  | 'isEmpty'
  | 'done'


const loadingVariants: Record<AllVariant, VariantType> = {
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
    minHeight: $props.retriable ? '22rem' : '20rem',
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
}
const animateOn = computed<AllVariant>(() => {
  if (!$props.hideLoading && unionSource.value.isLoading) {
    if (unionSource.value.isEmpty) return 'isLoadingNoData'
    else return 'isLoadingData'
  } else if (!$props.hideError && unionSource.value.isError) {
    if (unionSource.value.isEmpty) return 'isErrorNoData'
    else return 'isErrorData'
  } else if (!$props.hideEmpty && unionSource.value.isNoResult) {
    return 'isEmpty'
  }
  return 'done'
})


const cont = useTemplateRef('cont')
defineExpose({ cont })
</script>

<template>
  <div class="relative size-full overflow-hidden">
    <div class="relative size-full" :class="[$props.class]" ref="cont">
      <slot v-if="!unionSource.isEmpty" :data="unionSource.data" />
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
              class="w-full justify-center!"
              :class="[classEmpty]"
              :style="[style, styleEmpty]"
            />
          </div>
          <div v-else-if="animateOn === 'isErrorNoData'" class="size-full">
            <NResult
              class="flex size-full! flex-col items-center! justify-center! text-wrap *:w-full"
              status="error"
              title="网络错误"
              :class="[classError]"
              :style="[style, styleError]"
              :description="unionSource.errorCause ?? '未知原因'"
            >
              <template #footer>
                <NButton v-if="retriable" @click="$emit('resetRetry')" type="primary">重试</NButton>
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
              <div class="text-xs text-wrap">{{ unionSource.errorCause ?? '未知原因' }}</div>
            </div>
            <NButton circle type="error" size="large" @click="$emit('retry')">
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