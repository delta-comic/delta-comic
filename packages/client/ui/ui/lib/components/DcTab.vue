<script
  setup
  lang="ts"
  generic="T extends { name: string; title: string; route?: RouteLocationRaw }"
>
import { Mutex } from 'es-toolkit'
import { FreeMode } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/free-mode'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import { cn } from '@/utils'

import type { StyleProps } from '../utils'

const active = defineModel<string>()

const $props = withDefaults(
  defineProps<
    {
      /**
       * 基于路由的name匹配
       */
      items: T[]
      mode?: 'replace' | 'push'
      /** 是否使用路由模式，为 false 时使用 v-model 控制选中项 */
      router?: boolean
      /** 标签宽度自适应内容 */
      shrink?: boolean
      /** 是否启用手势滑动切换 */
      swipeable?: boolean
    } & StyleProps
  >(),
  { mode: 'replace', router: true, shrink: true, swipeable: false },
)

const $route = useRoute()
const $router = useRouter()
const swiperModules = [FreeMode]

const selecting = computed<string | undefined>(() => {
  if ($props.router) {
    const item = $props.items.find(v => {
      if (!v.route) return false
      const route = $router.resolve(v.route)
      return route.path == $route.path
    })
    return item?.name ?? $props.items.at(0)?.name
  }
  // 非路由模式：使用 v-model
  if (active.value && $props.items.some(v => v.name === active.value)) {
    return active.value
  }
  return $props.items.at(0)?.name
})

const routeLock = new Mutex()
const handleRoute = async (aimName: string) => {
  if (routeLock.isLocked) return false
  await routeLock.acquire()
  try {
    const item = $props.items.find(v => v.name == aimName)
    if (!item) throw new Error('Not found item in <DcTab>, name: ' + aimName)

    if ($props.router) {
      if (!item.route) throw new Error('Missing route in item <DcTab>, name: ' + aimName)
      await $router.force[$props.mode](item.route)
    } else {
      active.value = aimName
    }
    return true
  } finally {
    routeLock.release()
  }
}

// ============ Swiper 导航与下划线动画 ============
const swiperRef = ref<SwiperInstance>()
const swiperContainerRef = useTemplateRef('swiperContainerRef')
const tabRefs = ref<Record<string, HTMLElement>>({})

const indicatorX = ref(0)
const indicatorWidth = ref(0)
/** 首次渲染不显示下划线，避免从0位置闪动到目标 */
const indicatorReady = ref(false)

const selectedIndex = computed(() => $props.items.findIndex(v => v.name === selecting.value))

function setTabRef(name: string) {
  return (el: unknown) => {
    if (el instanceof HTMLElement) {
      tabRefs.value[name] = el
      // 首个标签出现后标记就绪
      if (!indicatorReady.value) indicatorReady.value = true
      requestAnimationFrame(updateIndicator)
    }
  }
}

function updateIndicator() {
  const name = selecting.value
  if (!name) return
  const el = tabRefs.value[name]
  if (!el || !swiperContainerRef.value) return
  const swiperRect = swiperContainerRef.value.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  indicatorX.value = elRect.left - swiperRect.left
  indicatorWidth.value = elRect.width
}

function slideToSelecting() {
  const index = selectedIndex.value
  if (index < 0) return
  swiperRef.value?.slideTo(index)
}

function onSwiper(swiper: SwiperInstance) {
  swiperRef.value = swiper
  requestAnimationFrame(() => {
    slideToSelecting()
    updateIndicator()
  })
}

// 选中项变化时更新并滚动到选中 tab
watch(selecting, async () => {
  await nextTick()
  slideToSelecting()
  requestAnimationFrame(updateIndicator)
})
// items 变化时让 Swiper 重新计算 slide 宽度（动态 tab）
watch(
  () => $props.items.length,
  async () => {
    await nextTick()
    swiperRef.value?.update()
    slideToSelecting()
    requestAnimationFrame(updateIndicator)
  },
)

const onSwipeEnd = (swiper: SwiperInstance) => {
  requestAnimationFrame(updateIndicator)
  if (!$props.swipeable) return

  const threshold = 60
  const diff = swiper.touches.diff
  if (diff < -threshold && selectedIndex.value < $props.items.length - 1) {
    handleRoute($props.items[selectedIndex.value + 1].name)
  } else if (diff > threshold && selectedIndex.value > 0) {
    handleRoute($props.items[selectedIndex.value - 1].name)
  }
}

defineSlots<{ left(): any; right(): any; bottom(): any }>()
</script>

<template>
  <div :class="cn('dc-tabs w-full', $props.class)" :style="style">
    <div
      class="dc-tabs__nav flex h-[var(--dc-tabs-height,44px)] items-center bg-(--dc-color-surface) pb-[var(--dc-tabs-indicator-offset,10px)]"
    >
      <slot name="left" />
      <div ref="swiperContainerRef" class="dc-tabs__swiper relative h-full min-w-0 flex-1">
        <Swiper
          class="dc-tabs__swiper-core h-full"
          :modules="swiperModules"
          :slides-per-view="shrink ? 'auto' : items.length || 1"
          :free-mode="true"
          :watch-slides-progress="true"
          @swiper="onSwiper"
          @resize="updateIndicator"
          @set-translate="updateIndicator"
          @transition-end="updateIndicator"
          @touch-end="onSwipeEnd"
        >
          <SwiperSlide
            v-for="item of items"
            :key="item.name"
            :class="
              cn('dc-tabs__slide flex! h-full min-w-0', shrink && 'dc-tabs__slide--shrink w-auto!')
            "
          >
            <div
              :ref="setTabRef(item.name)"
              :class="
                cn(
                  'dc-tabs__tab relative flex h-full flex-1 cursor-pointer touch-manipulation items-center justify-center px-3 select-none',
                  shrink && 'min-w-0 flex-none',
                  selecting === item.name && 'dc-tabs__tab--active',
                )
              "
              @click="handleRoute(item.name)"
            >
              <span
                :class="
                  cn(
                    'dc-tabs__tab-text text-sm whitespace-nowrap text-(--dc-color-text-secondary) transition-[color,font-weight] duration-200 ease-[ease]',
                    selecting === item.name && 'font-medium text-(--dc-color-text)',
                  )
                "
              >
                {{ item.title }}
              </span>
            </div>
          </SwiperSlide>
        </Swiper>
        <div
          v-show="indicatorReady"
          class="dc-tabs__indicator pointer-events-none absolute bottom-[var(--dc-tabs-indicator-offset,10px)] left-0 h-[3px] rounded-[3px] bg-[var(--dc-tabs-indicator-color,var(--dc-color-primary))] transition-[transform,width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          :style="{ transform: `translate3d(${indicatorX}px, 0, 0)`, width: `${indicatorWidth}px` }"
        />
      </div>
      <slot name="right" />
    </div>
    <slot name="bottom" />
  </div>
</template>