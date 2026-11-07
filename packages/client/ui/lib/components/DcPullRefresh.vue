<script setup lang="ts">
import { useMediaQuery, useSupported } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, type StyleValue, watch } from 'vue'

import { cn, type StyleProps } from '../utils'

import DcLoading from './DcLoading.vue'

const $props = withDefaults(
  defineProps<
    {
      disabled: boolean
      refresher: () => Promise<any>
      pullDistance?: number
      contentClass?: any
      contentStyle?: StyleValue
    } & StyleProps
  >(),
  { disabled: false, pullDistance: 58 },
)

const isRefreshing = defineModel<boolean>('refreshing', { default: false })
const isPulling = defineModel<boolean>('pulling', { default: false })
defineSlots<{ default(): any }>()

// ── state machine ──
type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing'
const pullState = ref<PullState>('idle')

watch(pullState, s => {
  isPulling.value = s !== 'idle'
})

// ── drag tracking ──
const distance = ref(0)
const startY = ref(0)
const startX = ref(0)
const isDragging = ref(false)
const transitioning = ref(false)
const containerRef = ref<HTMLElement>()

const threshold = computed(() => $props.pullDistance)
const maxDistance = computed(() => threshold.value * 2.2)
const progress = computed(() => Math.min(distance.value / threshold.value, 1))
const isCoarsePointer = useMediaQuery('(pointer: coarse)')
const hasTouchSupport = useSupported(
  () =>
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)),
)
const isPullRefreshEnabled = computed(
  () => !$props.disabled && hasTouchSupport.value && isCoarsePointer.value,
)

function canPull(): boolean {
  const el = containerRef.value
  return !!el && el.scrollTop <= 0
}

function resetGesture() {
  startY.value = 0
  startX.value = 0
  isDragging.value = false
}

function resetPullState() {
  distance.value = 0
  pullState.value = 'idle'
  transitioning.value = false
  resetGesture()
}

function getRubberBandDistance(delta: number) {
  const dampened = delta * 0.45
  if (dampened <= threshold.value) return dampened

  const extra = dampened - threshold.value
  return Math.min(threshold.value + extra * 0.28, maxDistance.value)
}

// ── touch handlers ──
function onTouchStart(e: TouchEvent) {
  if (!isPullRefreshEnabled.value || isRefreshing.value || transitioning.value || !canPull()) return

  startY.value = e.touches[0].clientY
  startX.value = e.touches[0].clientX
}

function onTouchMove(e: TouchEvent) {
  if (!startY.value || !isPullRefreshEnabled.value || isRefreshing.value || transitioning.value)
    return

  const touch = e.touches[0]
  const deltaY = touch.clientY - startY.value
  const deltaX = Math.abs(touch.clientX - startX.value)

  if (deltaY <= 0 || !canPull()) {
    distance.value = 0
    pullState.value = 'idle'
    resetGesture()
    return
  }

  if (!isDragging.value && deltaX > deltaY) return

  isDragging.value = true
  e.preventDefault()

  distance.value = getRubberBandDistance(deltaY)
  pullState.value = distance.value >= threshold.value ? 'ready' : 'pulling'
}

function onTouchEnd() {
  if (!startY.value || !isPullRefreshEnabled.value || isRefreshing.value || transitioning.value)
    return

  resetGesture()

  if (pullState.value === 'ready') {
    doRefresh()
  } else if (distance.value > 0) {
    settleTo(0)
  }
}

// ── animation ──
function settleTo(target: number) {
  transitioning.value = true
  distance.value = target
  if (target === 0) pullState.value = 'idle'

  setTimeout(() => {
    transitioning.value = false
  }, 320)
}

async function doRefresh() {
  pullState.value = 'refreshing'
  isRefreshing.value = true
  transitioning.value = true
  distance.value = threshold.value

  await new Promise(r => setTimeout(r, 220))
  transitioning.value = false

  try {
    await $props.refresher()
  } finally {
    isRefreshing.value = false
    settleTo(0)
  }
}

watch(
  isPullRefreshEnabled,
  enabled => {
    if (!enabled) resetPullState()
  },
  { immediate: true },
)

watch(isRefreshing, refreshing => {
  if (!refreshing || pullState.value === 'refreshing' || !isPullRefreshEnabled.value) return
  pullState.value = 'refreshing'
  distance.value = threshold.value
})

onMounted(() => {
  containerRef.value?.addEventListener('touchmove', onTouchMove, { passive: false })
})

onUnmounted(() => {
  containerRef.value?.removeEventListener('touchmove', onTouchMove)
})

// ── derived styles ──
const contentStyle = computed(() => ({
  transform: `translate3d(0, ${distance.value}px, 0)`,
  transition: transitioning.value ? 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
  willChange: transitioning.value ? undefined : 'transform',
}))

const indicatorStyle = computed(() => ({
  height: `${Math.max(distance.value, pullState.value === 'refreshing' ? threshold.value : 0)}px`,
  opacity: pullState.value !== 'idle' ? 1 : 0,
  transition:
    transitioning.value || pullState.value === 'idle'
      ? 'height 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease'
      : 'none',
}))

const indicatorFaceStyle = computed(() => ({
  transform: `translateY(${8 - progress.value * 8}px) scale(${0.86 + progress.value * 0.14})`,
  opacity: 0.35 + progress.value * 0.65,
}))
</script>

<template>
  <div
    ref="containerRef"
    :class="cn('relative overflow-x-hidden overflow-y-auto overscroll-contain', $props.class)"
    :style="$props.style"
    @touchstart.passive="onTouchStart"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <div
      v-if="isPullRefreshEnabled"
      class="pointer-events-none absolute top-0 right-0 left-0 z-1 flex items-end justify-center overflow-hidden"
      :style="indicatorStyle"
      aria-hidden="true"
    >
      <div
        class="mb-2 flex size-9 items-center justify-center rounded-full bg-white shadow-lg"
        :style="indicatorFaceStyle"
      >
        <DcLoading size="26px" color="var(--p-color)" :spinning="pullState === 'refreshing'" />
      </div>
    </div>

    <div :class="$props.contentClass" :style="[contentStyle, $props.contentStyle]">
      <slot />
    </div>
  </div>
</template>