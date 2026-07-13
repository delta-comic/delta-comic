<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { useTemp } from '@delta-comic/utils'
import { computedAsync } from '@vueuse/core'
import { isString } from 'es-toolkit/compat'
import { type ImageProps, NIcon, NImage } from 'naive-ui'
import {
  type ImgHTMLAttributes,
  type StyleValue,
  computed,
  nextTick,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'

import { translateUi } from '@/i18n'
import { cn } from '@/utils'

import DcLoading from './DcLoading.vue'
import { WarningRound } from './icons'

const $props = withDefaults(
  defineProps<{
    src?: uni.image.Image_
    alt?: string
    previewable?: boolean
    retryMax?: number
    round?: boolean
    fit?: ImageProps['objectFit']
    class?: any
    hideLoading?: boolean
    hideError?: boolean
    inline?: boolean
    style?: StyleValue
    imgProp?: ImgHTMLAttributes
    cacheList?: { loaded: Set<string>; error: Set<string> }
    fetchpriority?: 'high' | 'low' | 'auto'
    fallback?: uni.image.Image_
  }>(),
  { fetchpriority: 'auto', retryMax: 4 },
)
const src = computedAsync(async () => {
  try {
    if (!$props.src) return ''
    if (isString($props.src)) return $props.src
    return await $props.src.getUrl()
  } catch (error) {
    console.warn(error)
  }
  return ''
}, '')

const $emit = defineEmits<{ load: any[]; click: [e: Event]; error: [] }>()

let reloadTime = 0
let isForkEmpty = false
const handleFail = async () => {
  if (isForkEmpty) {
    images.error.add(src.value)
    return $emit('error')
  }
  reloadTime++
  show.value = false
  if (reloadTime > $props.retryMax) {
    if (!uni.resource.Resource.is($props.src)) {
      isForkEmpty = true
      handleFail()
      return
    }
    if ($props.src.localChangeFork()) {
      isForkEmpty = true
      handleFail()
      return
    }
    reloadTime = 0
  }
  await nextTick()
  show.value = true
}

const temp = useTemp().$apply('imageState', () => ({
  loaded: new Set<string>(),
  error: new Set<string>(),
}))
const images = $props.cacheList ?? temp
const show = shallowRef(true)
const beginReload = () => {
  isForkEmpty = false
  reloadTime = 0
  handleFail()
}
watch(src, beginReload)
defineSlots<{ loading?(): any; fail?(): any }>()
const isLoaded = computed(() => images.loaded.has(src.value))
const fallbackSrc = computedAsync(async () => {
  try {
    if (!$props.fallback) return
    if (isString($props.fallback)) return $props.fallback
    return await $props.fallback.getUrl()
  } catch (error) {
    console.error(error)
  }
  return
}, undefined)

const handleClickImage = (e: Event) => $emit('click', e)

const handleImageLoad = (...e: Event[]) => {
  $emit('load', ...e)
  images.loaded.add(src.value)
}
const img = useTemplateRef('img')
defineExpose({ isLoaded, imageEl: computed(() => img.value?.imageRef), imageIns: img })
</script>

<template>
  <NImage
    :="$props"
    @error="handleFail"
    :objectFit="fit"
    :previewDisabled="!previewable"
    :alt
    ref="img"
    :imgProps="{
      ...imgProp,
      class: cn(imgProp?.class, 'w-full'),
      fetchpriority: $props.fetchpriority,
    }"
    :class="cn(round && 'rounded-full!', inline ? 'inline-flex' : 'flex', $props.class)"
    :style
    v-if="show"
    @load="handleImageLoad"
    @click="handleClickImage"
    :src
    :fallbackSrc
  >
    <template #error v-if="!hideError">
      <div
        @click.stop="
          () => {
            images.error.delete(src)
            beginReload()
          }
        "
        class="size-full flex-col items-center justify-center"
      >
        <slot name="loading" v-if="$slots.loading"></slot>
        <template v-else>
          <NIcon size="2.5rem" color="var(--dc-color-text-secondary)">
            <WarningRound />
          </NIcon>
          <div class="text-sm text-(--dc-color-text-secondary)">
            {{ translateUi('image.retry') }}
          </div>
        </template>
      </div>
    </template>
    <template #placeholder>
      <div
        v-if="!hideLoading"
        :class="[
          'size-full items-center justify-center',
          round && 'rounded-full!',
          inline ? 'inline-flex' : 'flex',
        ]"
        :style
        @click="$emit('click', $event)"
      >
        <slot name="loading" v-if="$slots.loading"></slot>
        <DcLoading v-else />
      </div>
    </template>
  </NImage>
</template>