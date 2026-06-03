<script setup lang="ts">
import { computed, getCurrentInstance, useSlots } from 'vue'
import { useRouter } from 'vue-router'

import { cn } from '@/utils'

const $props = withDefaults(
  defineProps<{
    tag?: string
    icon?: string
    size?: 'normal' | 'large'
    title?: string | number
    value?: string | number
    label?: string | number
    center?: boolean
    isLink?: boolean
    border?: boolean
    iconPrefix?: string
    valueClass?: any
    labelClass?: any
    titleClass?: any
    titleStyle?: string | Record<string, any>
    arrowDirection?: 'up' | 'down' | 'left' | 'right'
    required?: boolean | 'auto'
    clickable?: boolean | null
    /** vue-router 路由跳转 */
    to?: any
    url?: string
    replace?: boolean
    class?: any
    style?: any
  }>(),
  { tag: 'div', border: true, required: undefined, clickable: undefined },
)

const slots = useSlots()
const vm = getCurrentInstance()!.proxy!

function navigate() {
  if ($props.to && vm.$router) {
    const router = vm.$router as ReturnType<typeof useRouter>
    router[$props.replace ? 'replace' : 'push']($props.to)
  } else if ($props.url) {
    if ($props.replace) {
      location.replace($props.url)
    } else {
      location.href = $props.url
    }
  }
}

const isClickable = computed(() => ($props.clickable != null ? $props.clickable : $props.isLink))

const bem = (mods?: Record<string, boolean | undefined>) => {
  const base = 'dc-cell'
  if (!mods) return base
  const classes = [base]
  for (const [k, v] of Object.entries(mods)) {
    if (v) classes.push(`${base}--${k}`)
  }
  return classes.join(' ')
}

const renderArrowIcon = computed(() => {
  if (!$props.isLink) return ''
  const dir = $props.arrowDirection
  if (!dir || dir === 'right') return '›'
  if (dir === 'left') return '‹'
  if (dir === 'up') return '⌃'
  return '⌄'
})
</script>

<template>
  <component
    :is="tag"
    :class="
      cn(
        bem({
          center,
          required: !!required,
          clickable: isClickable,
          borderless: !border,
          [size || '']: !!size,
        }),
        $props.class,
      )
    "
    :style="$props.style"
    :role="isClickable ? 'button' : undefined"
    :tabindex="isClickable ? 0 : undefined"
    @click="navigate"
  >
    <!-- left icon -->
    <div v-if="slots.icon || icon" class="dc-cell__left-icon">
      <slot v-if="slots.icon" name="icon" />
      <span v-else class="van-icon" :class="[iconPrefix, icon]" />
    </div>

    <!-- title area -->
    <div :class="cn('dc-cell__title', titleClass)" :style="titleStyle">
      <slot v-if="slots.title" name="title" />
      <span v-else-if="title != null">{{ title }}</span>
      <div v-if="slots.label || label != null" :class="cn('dc-cell__label', labelClass)">
        <slot v-if="slots.label" name="label" />
        <template v-else>{{ label }}</template>
      </div>
    </div>

    <!-- value area -->
    <div
      v-if="slots.value || slots.default || value != null"
      :class="cn('dc-cell__value', valueClass)"
    >
      <slot v-if="slots.value" name="value" />
      <slot v-else-if="slots.default" />
      <span v-else>{{ value }}</span>
    </div>

    <!-- right icon -->
    <div v-if="slots['right-icon'] || isLink" class="dc-cell__right-icon">
      <slot v-if="slots['right-icon']" name="right-icon" />
      <span v-else class="dc-cell__arrow">{{ renderArrowIcon }}</span>
    </div>

    <!-- extra slot -->
    <slot v-if="slots.extra" name="extra" />
  </component>
</template>

<style>
:root,
:host {
  --van-cell-font-size: var(--van-font-size-md);
  --van-cell-line-height: 24px;
  --van-cell-vertical-padding: 10px;
  --van-cell-horizontal-padding: var(--van-padding-md);
  --van-cell-text-color: var(--van-text-color);
  --van-cell-background: var(--van-background-2);
  --van-cell-border-color: var(--van-border-color);
  --van-cell-active-color: var(--van-active-color);
  --van-cell-required-color: var(--van-danger-color);
  --van-cell-label-color: var(--van-text-color-2);
  --van-cell-label-font-size: var(--van-font-size-sm);
  --van-cell-label-line-height: var(--van-line-height-sm);
  --van-cell-label-margin-top: var(--van-padding-base);
  --van-cell-value-color: var(--van-text-color-2);
  --van-cell-value-font-size: inherit;
  --van-cell-icon-size: 16px;
  --van-cell-right-icon-color: var(--van-gray-6);
  --van-cell-large-vertical-padding: var(--van-padding-sm);
  --van-cell-large-title-font-size: var(--van-font-size-lg);
  --van-cell-large-label-font-size: var(--van-font-size-md);
  --van-cell-large-value-font-size: inherit;
}

.dc-cell {
  position: relative;
  display: flex;
  box-sizing: border-box;
  width: 100%;
  padding: var(--van-cell-vertical-padding) var(--van-cell-horizontal-padding);
  overflow: hidden;
  color: var(--van-cell-text-color);
  font-size: var(--van-cell-font-size);
  line-height: var(--van-cell-line-height);
  background: var(--van-cell-background);
}

.dc-cell::after {
  position: absolute;
  box-sizing: border-box;
  content: ' ';
  pointer-events: none;
  right: var(--van-padding-md);
  bottom: 0;
  left: var(--van-padding-md);
  border-bottom: 1px solid var(--van-cell-border-color);
  transform: scaleY(0.5);
}

.dc-cell:last-child::after,
.dc-cell--borderless::after {
  display: none;
}

.dc-cell__label {
  margin-top: var(--van-cell-label-margin-top);
  color: var(--van-cell-label-color);
  font-size: var(--van-cell-label-font-size);
  line-height: var(--van-cell-label-line-height);
}

.dc-cell__title,
.dc-cell__value {
  flex: 1;
}

.dc-cell__value {
  position: relative;
  overflow: hidden;
  color: var(--van-cell-value-color);
  font-size: var(--van-cell-value-font-size);
  text-align: right;
  vertical-align: middle;
  word-wrap: break-word;
}

.dc-cell__left-icon,
.dc-cell__right-icon {
  height: var(--van-cell-line-height);
  font-size: var(--van-cell-icon-size);
  line-height: var(--van-cell-line-height);
}

.dc-cell__left-icon {
  margin-right: var(--van-padding-base);
}

.dc-cell__right-icon {
  margin-left: var(--van-padding-base);
  color: var(--van-cell-right-icon-color);
}

.dc-cell--clickable {
  cursor: pointer;
}

.dc-cell--clickable:active {
  background-color: var(--van-cell-active-color);
}

.dc-cell--required {
  overflow: visible;
}

.dc-cell--required::before {
  position: absolute;
  left: var(--van-padding-xs);
  color: var(--van-cell-required-color);
  font-size: var(--van-cell-font-size);
  content: '*';
}

.dc-cell--center {
  align-items: center;
}

.dc-cell--large {
  padding-top: var(--van-cell-large-vertical-padding);
  padding-bottom: var(--van-cell-large-vertical-padding);
}

.dc-cell--large .dc-cell__title {
  font-size: var(--van-cell-large-title-font-size);
}

.dc-cell--large .dc-cell__label {
  font-size: var(--van-cell-large-label-font-size);
}

.dc-cell--large .dc-cell__value {
  font-size: var(--van-cell-large-value-font-size);
}

.dc-cell__arrow {
  font-size: 18px;
  font-weight: 200;
}
</style>