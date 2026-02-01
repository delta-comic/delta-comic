<script setup lang="ts">
import { computed, type StyleValue, useTemplateRef } from 'vue'
import { MoreVertRound } from '@vicons/material'
import { createReusableTemplate } from '@vueuse/core'
import { Comp, Store, uni, Utils } from 'delta-comic-core'
import { EyeInvisibleOutlined } from '@vicons/antd'
const $props = withDefaults(
  defineProps<{
    item: uni.item.Item | uni.item.RawItem
    freeHeight?: boolean
    disabled?: boolean
    type?: 'default' | 'big' | 'small'
    class?: any
    style?: StyleValue
  }>(),
  { type: 'default' }
)
const $emit = defineEmits<{ click: [] }>()
const cover = useTemplateRef<InstanceType<typeof Comp.Image>>('cover')
const $cover = computed(() =>
  uni.item.Item.is($props.item) ? $props.item.$cover : uni.image.Image.create($props.item.cover)
)
const imageRatio = computed(() =>
  cover.value?.isLoaded
    ? 'unset'
    : `${$cover.value.aspect?.width || cover.value?.imageEl?.getBoundingClientRect().width || 3} / ${$cover.value.aspect?.height || cover.value?.imageEl?.getBoundingClientRect().height || 4}`
)

defineSlots<{ default(): void; smallTopInfo(): void; cover(): void }>()
const [TemplateIns, ComponentIns] = createReusableTemplate()
const handlePositiveClick = () => {
  // add recent
  if (uni.item.Item.is($props.item)) Utils.eventBus.SharedFunction.call('addRecent', $props.item)
}
const config = Store.useConfig().$load(Store.appConfig)
const processedTitle = computed(() =>
  config.value.easilyTitle
    ? $props.item.title
        .replace(/(\（[^\）]+\）|\[[^\]]+\]|\([^\)]+\)|\【[^\】]+\】)+?/gi, '')
        .trim()
    : $props.item.title
)

const handleClick = () => {
  Utils.eventBus.SharedFunction.call(
    'routeToContent',
    $props.item.contentType,
    $props.item.id,
    $props.item.thisEp.index,
    uni.item.Item.is($props.item) ? $props.item : undefined
  )
  $emit('click')
}

const isSafetied = computed(() =>
  window.$$safe$$ ? ($props.item.customIsSafe ? true : $props.item.customIsSafe) : true
)
</script>

<template>
  <TemplateIns>
    <NPopconfirm @positive-click="handlePositiveClick">
      <template #trigger>
        <NButton @click.stop text class="absolute! right-2 bottom-1.5">
          <NIcon color="var(--van-text-color-2)" size="1rem">
            <MoreVertRound />
          </NIcon>
        </NButton>
      </template>
      加入"稍后再看"?
    </NPopconfirm>
  </TemplateIns>
  <div
    ref="container"
    @click="handleClick"
    :disabled
    v-if="type != 'small'"
    class="van-hairline--top-bottom relative flex w-full overflow-hidden bg-(--van-background-2) p-2 text-(--van-text-color)"
    :style="[{ height: freeHeight ? 'auto' : '140px' }, style]"
    :class="[{ 'van-haptics-feedback': !disabled }, $props.class]"
  >
    <Comp.Image
      :src="$cover"
      v-if="type === 'big'"
      class="absolute top-0 left-0 h-full w-full blur-lg"
      fit="cover"
    />
    <Comp.Image :src="$cover" class="image-size z-2 w-3/10 rounded-lg!" fit="contain" ref="cover" />
    <div class="absolute bottom-0 z-3 h-fit w-3/10">
      <slot name="cover" />
    </div>
    <div
      class="absolute right-2 flex h-[calc(100%-8px)] w-[calc(70%-18px)] flex-col *:text-justify"
    >
      <span class="van-multi-ellipsis--l2">{{ processedTitle }}</span>
      <div class="absolute bottom-2 text-sm text-(--van-text-color-2)">
        <slot />
      </div>
    </div>
    <ComponentIns />
    <div
      class="use-backdrop-blur-md absolute top-0.5 left-0.5 z-100 size-[calc(100%-var(--spacing)*1)] rounded-lg bg-white/10"
      v-if="!isSafetied"
    >
      <div
        class="absolute top-1/2 left-3 flex -translate-y-1/2 items-center gap-2 text-xl font-semibold text-(--van-text-color)"
      >
        <NIcon color="var(--van-text-color)" size="40px">
          <EyeInvisibleOutlined />
        </NIcon>
        该内容疑似不安全
      </div>
    </div>
  </div>

  <div
    :style="[{ height: freeHeight ? 'auto' : '140px' }, style]"
    v-else
    @click="handleClick"
    :disabled
    :class="[{ 'van-haptics-feedback': !disabled }, $props.class]"
    ref="container"
    class="van-hairline--top-bottom relative block w-full items-center overflow-hidden rounded-lg border-none bg-(--van-background-2) bg-center p-0 text-(--van-text-color)"
  >
    <div class="relative flex w-full items-center">
      <Comp.Image :src="$cover" class="image-size w-full rounded-t-lg" fit="cover" ref="cover" />
      <slot name="cover" />
      <div
        class="absolute bottom-0 flex h-6 w-full items-end justify-start gap-1 bg-[linear-gradient(transparent,rgba(0,0,0,0.9))] pb-0.5 pl-1 text-[10px]! text-white *:flex *:items-center"
      >
        <slot name="smallTopInfo" />
      </div>
    </div>
    <div class="flex w-full flex-col overflow-hidden p-1 text-(--van-text-color)">
      <div class="flex flex-nowrap">
        <span class="text-start text-sm">{{ processedTitle }}</span>
      </div>
      <div class="my-1 flex h-auto w-full flex-nowrap items-center">
        <slot />
      </div>
    </div>
    <ComponentIns />
    <div
      class="use-backdrop-blur-md absolute top-0.5 left-0 z-100 size-[calc(100%-var(--spacing)*1)] w-full rounded-lg bg-white/10"
      v-if="!isSafetied"
    >
      <div
        class="absolute top-1/2 left-3 flex -translate-y-1/2 flex-col items-center gap-2 text-xl font-semibold text-(--van-text-color)"
      >
        <NIcon color="var(--van-text-color)" size="40px">
          <EyeInvisibleOutlined />
        </NIcon>
        该内容疑似不安全
      </div>
    </div>
  </div>
</template>
<style scoped lang="css">
:deep(.image-size) {
  aspect-ratio: v-bind('imageRatio');
}
</style>