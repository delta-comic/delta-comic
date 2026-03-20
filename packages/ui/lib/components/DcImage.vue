<script setup lang="ts">
import { useTemp } from '@delta-comic/core'
import { uni } from '@delta-comic/model'
import { computedAsync } from '@vueuse/core'
import { isString } from 'es-toolkit/compat'
import { type ImageProps, NImage } from 'naive-ui'
import {
  type ImgHTMLAttributes,
  type StyleValue,
  computed,
  nextTick,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import { showImagePreview } from '@/utils/image'

import DcLoading from './DcLoading.vue'
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
    useList?: { loaded: Set<string>; error: Set<string> }
    fetchpriority?: 'high' | 'low' | 'auto'
    fallback?: uni.image.Image_
  }>(),
  { fetchpriority: 'auto', retryMax: 4 }
)
const src = computedAsync(async () => {
  try {
    if (!$props.src) return ''
    if (isString($props.src)) return $props.src
    return await $props.src.getUrl()
  } catch (error) {
    console.error(error)
  }
  return ''
}, '')


const $emit = defineEmits<{ load: any[]; click: []; error: [] }>()


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
    if (!$props.src.localChangeFork()) {
      isForkEmpty = true
      handleFail()
      return
    }
  }
  await nextTick()
  show.value = true
}


const temp = useTemp().$apply('imageState', () => ({
  loaded: new Set<string>(),
  error: new Set<string>()
}))
const images = $props.useList ?? temp
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
    if (!$props.fallback) return ''
    if (isString($props.fallback)) return $props.fallback
    return await $props.fallback.getUrl()
  } catch (error) {
    console.error(error)
  }
  return ''
}, '')


const handleClickImage = (e: Event) => {
  $emit('click')
  if (!$props.previewable) return
  e.stopPropagation()
  showImagePreview([src.value], { closeable: true })
}
const handleImageLoad = (...e: Event[]) => {
  $emit('load', ...e)
  images.loaded.add(src.value)
}
const img = useTemplateRef('img')
defineExpose({ isLoaded, imageEl: computed(() => img.value?.imageRef), imageIns: img })
const NImg = window.$api.NImage as typeof NImage
</script>

<template>
  <NImg
    @error="handleFail"
    v-bind="$props"
    :object-fit="fit"
    preview-disabled
    :alt
    ref="img"
    :img-props="{
      ...(imgProp ?? {}),
      class: 'w-full',
      ['fetchpriority' as any]: $props.fetchpriority
    }"
    :class="[{ 'rounded-full!': !!round }, inline ? 'inline-flex' : 'flex', $props.class]"
    :style
    v-show="!images.error.has(src) && images.loaded.has(src)"
    v-if="show"
    @load="handleImageLoad"
    @click="handleClickImage"
    :src
  >
  </NImg>
  <div
    class="items-center justify-center"
    v-if="!images.loaded.has(src) && !images.error.has(src) && !hideLoading"
    :class="[{ 'rounded-full!': !!round }, inline ? 'inline-flex' : 'flex', $props.class]"
    :style
    @click="$emit('click')"
  >
    <slot name="loading" v-if="$slots.loading"></slot>
    <DcLoading v-else />
  </div>
  <template v-if="images.error.has(src) && !hideError">
    <NImg
      @error="handleFail"
      v-bind="$props"
      :object-fit="fit"
      preview-disabled
      :alt
      :img-props="{
        ...(imgProp ?? {}),
        class: 'w-full',
        ['fetchpriority' as any]: $props.fetchpriority
      }"
      :class="[{ 'rounded-full!': !!round }, inline ? 'inline-flex' : 'flex', $props.class]"
      :style
      v-if="fallback"
      :src="fallbackSrc"
    />
    <div
      class="flex-col items-center justify-center"
      @click.stop="
        () => {
          images.error.delete(src)
          beginReload()
        }
      "
      v-else
      :class="[{ 'rounded-full!': !!round }, inline ? 'inline-flex' : 'flex', $props.class]"
    >
      <slot name="loading" v-if="$slots.loading"></slot>
      <template v-else>
        <VanIcon name="warning-o" size="2.5rem" color="var(--van-text-color-2)" />
        <div class="text-sm text-(--van-text-color-2)">点击重试</div>
      </template>
    </div>
  </template>
</template>