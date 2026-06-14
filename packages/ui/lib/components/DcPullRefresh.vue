<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { cn, type StyleProps } from '../utils'

import DcLoading from './DcLoading.vue'

const $props = withDefaults(
  defineProps<
    { disabled: boolean; refresher: () => Promise<any>; pullDistance?: number } & StyleProps
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
const progressPercent = computed(() => `${Math.round(progress.value * 100)}%`)
const arrowRotation = computed(() => `${progress.value * 180}deg`)
const pullText = computed(() => {
  switch (pullState.value) {
    case 'ready':
      return '松手刷新'
    case 'refreshing':
      return '正在刷新...'
    case 'pulling':
      return '下拉刷新'
    default:
      return '下拉刷新'
  }
})

function canPull(): boolean {
  const el = containerRef.value
  return !!el && el.scrollTop <= 0
}

function resetGesture() {
  startY.value = 0
  startX.value = 0
  isDragging.value = false
}

function getRubberBandDistance(delta: number) {
  const dampened = delta * 0.45
  if (dampened <= threshold.value) return dampened

  const extra = dampened - threshold.value
  return Math.min(threshold.value + extra * 0.28, maxDistance.value)
}

// ── touch handlers ──
function onTouchStart(e: TouchEvent) {
  if ($props.disabled || isRefreshing.value || transitioning.value || !canPull()) return

  startY.value = e.touches[0].clientY
  startX.value = e.touches[0].clientX
}

function onTouchMove(e: TouchEvent) {
  if (!startY.value || $props.disabled || isRefreshing.value || transitioning.value) return

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
  if (!startY.value || $props.disabled || isRefreshing.value || transitioning.value) return

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
  () => $props.disabled,
  v => {
    if (v) {
      distance.value = 0
      pullState.value = 'idle'
      transitioning.value = false
      resetGesture()
    }
  },
)

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

const faceStyle = computed(() => ({
  transform: `translateY(${8 - progress.value * 8}px) scale(${0.86 + progress.value * 0.14})`,
  opacity: 0.35 + progress.value * 0.65,
}))

const bubbleStyle = computed(() => ({
  '--dc-pull-progress': progressPercent.value,
  '--dc-pull-arrow-rotate': arrowRotation.value,
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
      class="pointer-events-none absolute top-0 right-0 left-0 z-1 flex items-end justify-center overflow-hidden"
      :style="indicatorStyle"
      aria-hidden="true"
    >
      <div class="dc-pull-refresh__stage pb-2" :style="bubbleStyle">
        <div class="dc-pull-refresh__mascot" :style="faceStyle">
          <div class="dc-pull-refresh__antenna" />
          <div class="dc-pull-refresh__face">
            <span class="dc-pull-refresh__eye dc-pull-refresh__eye--left" />
            <span class="dc-pull-refresh__eye dc-pull-refresh__eye--right" />
            <span class="dc-pull-refresh__mouth" />
          </div>
        </div>

        <div class="dc-pull-refresh__bubble">
          <DcLoading v-if="pullState === 'refreshing'" size="14px" />
          <span v-else class="dc-pull-refresh__arrow">↓</span>
          <span>{{ pullText }}</span>
        </div>
      </div>
    </div>

    <div :style="contentStyle">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.dc-pull-refresh__stage {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fb7299;
  font-size: 13px;
  line-height: 1;
}

.dc-pull-refresh__mascot {
  position: relative;
  width: 34px;
  height: 28px;
  transition: opacity 0.18s ease;
}

.dc-pull-refresh__antenna {
  position: absolute;
  top: 0;
  left: 50%;
  width: 16px;
  height: 10px;
  border-top: 2px solid currentColor;
  border-left: 2px solid currentColor;
  border-radius: 10px 0 0;
  transform: translateX(-15%) rotate(22deg);
  transform-origin: bottom left;
}

.dc-pull-refresh__antenna::after {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 999px;
  content: '';
}

.dc-pull-refresh__face {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 23px;
  overflow: hidden;
  background: #fff;
  border: 2px solid currentColor;
  border-radius: 7px;
  box-shadow: 0 5px 14px rgb(251 114 153 / 18%);
}

.dc-pull-refresh__face::before,
.dc-pull-refresh__face::after {
  position: absolute;
  top: 6px;
  width: 4px;
  height: 8px;
  background: #fff;
  border: 2px solid currentColor;
  content: '';
}

.dc-pull-refresh__face::before {
  left: -4px;
  border-radius: 4px 0 0 4px;
}

.dc-pull-refresh__face::after {
  right: -4px;
  border-radius: 0 4px 4px 0;
}

.dc-pull-refresh__eye {
  position: absolute;
  top: 8px;
  width: 4px;
  height: 4px;
  background: currentColor;
  border-radius: 999px;
}

.dc-pull-refresh__eye--left {
  left: 9px;
}

.dc-pull-refresh__eye--right {
  right: 9px;
}

.dc-pull-refresh__mouth {
  position: absolute;
  right: 13px;
  bottom: 5px;
  left: 13px;
  height: 4px;
  border-bottom: 2px solid currentColor;
  border-radius: 0 0 999px 999px;
}

.dc-pull-refresh__bubble {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 92px;
  gap: 5px;
  padding: 7px 10px;
  overflow: hidden;
  color: #fb7299;
  background: rgb(251 114 153 / 10%);
  border: 1px solid rgb(251 114 153 / 18%);
  border-radius: 999px;
}

.dc-pull-refresh__bubble::before {
  position: absolute;
  inset: 0;
  width: var(--dc-pull-progress);
  background: linear-gradient(90deg, rgb(251 114 153 / 14%), rgb(251 114 153 / 4%));
  content: '';
}

.dc-pull-refresh__bubble > * {
  position: relative;
  z-index: 1;
}

.dc-pull-refresh__arrow {
  font-size: 14px;
  transform: rotate(var(--dc-pull-arrow-rotate));
  transition: transform 0.18s ease;
}
</style>
