<script setup lang="ts">
import { computed, getCurrentInstance, useSlots } from 'vue'

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
const emit = defineEmits<{ click: [event: MouseEvent] }>()

const slots = useSlots()
const vm = getCurrentInstance()!.proxy!

function navigate() {
  if ($props.to && vm.$router) {
    vm.$router[$props.replace ? 'replace' : 'push']($props.to)
  } else if ($props.url) {
    if ($props.replace) {
      location.replace($props.url)
    } else {
      location.href = $props.url
    }
  }
}

function handleClick(event: MouseEvent) {
  navigate()
  emit('click', event)
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
        `relative box-border flex w-full overflow-hidden px-[var(--dc-cell-horizontal-padding,var(--dc-space-4))] py-[var(--dc-cell-vertical-padding,10px)] text-[length:var(--dc-cell-font-size,var(--dc-font-size-md))] leading-[var(--dc-cell-line-height,var(--dc-line-height-md))] text-[color:var(--dc-cell-text-color,var(--dc-color-text))] [background:var(--dc-cell-background,var(--dc-color-surface))] after:pointer-events-none after:absolute after:right-[var(--dc-space-4)] after:bottom-0 after:left-[var(--dc-space-4)] after:box-border after:scale-y-50 after:border-b after:border-[var(--dc-cell-border-color,var(--dc-color-border))] after:content-[''] last:after:hidden`,
        center && 'items-center',
        isClickable &&
          'cursor-pointer active:bg-[var(--dc-cell-active-color,var(--dc-color-active))]',
        !border && 'after:hidden',
        required &&
          `overflow-visible before:absolute before:left-[var(--dc-space-2)] before:text-[length:var(--dc-cell-font-size,var(--dc-font-size-md))] before:text-[color:var(--dc-cell-required-color,var(--dc-color-danger))] before:content-['*']`,
        size === 'large' && 'py-[var(--dc-cell-large-vertical-padding,var(--dc-space-3))]',
        $props.class,
      )
    "
    :style="$props.style"
    :role="isClickable ? 'button' : undefined"
    :tabindex="isClickable ? 0 : undefined"
    @click="handleClick"
  >
    <!-- left icon -->
    <div
      v-if="slots.icon || icon"
      class="dc-cell__left-icon mr-[var(--dc-space-1)] h-[var(--dc-cell-line-height,var(--dc-line-height-md))] text-[length:var(--dc-cell-icon-size,16px)] leading-[var(--dc-cell-line-height,var(--dc-line-height-md))]"
    >
      <slot v-if="slots.icon" name="icon" />
      <span
        v-else
        class="dc-cell__icon inline-flex size-[1em] items-center justify-center not-italic"
        :class="[iconPrefix, icon]"
        :aria-label="icon"
        role="img"
      />
    </div>

    <!-- title area -->
    <div
      :class="
        cn(
          'dc-cell__title flex-1',
          size === 'large' &&
            'text-[length:var(--dc-cell-large-title-font-size,var(--dc-font-size-lg))]',
          titleClass,
        )
      "
      :style="titleStyle"
    >
      <slot v-if="slots.title" name="title" />
      <span v-else-if="title != null">{{ title }}</span>
      <div
        v-if="slots.label || label != null"
        :class="
          cn(
            'dc-cell__label mt-[var(--dc-cell-label-margin-top,var(--dc-space-1))] text-[length:var(--dc-cell-label-font-size,var(--dc-font-size-sm))] leading-[var(--dc-cell-label-line-height,var(--dc-line-height-sm))] text-[color:var(--dc-cell-label-color,var(--dc-color-text-secondary))]',
            size === 'large' &&
              'text-[length:var(--dc-cell-large-label-font-size,var(--dc-font-size-md))]',
            labelClass,
          )
        "
      >
        <slot v-if="slots.label" name="label" />
        <template v-else>{{ label }}</template>
      </div>
    </div>

    <!-- value area -->
    <div
      v-if="slots.value || slots.default || value != null"
      :class="
        cn(
          'dc-cell__value relative flex-1 overflow-hidden text-right align-middle text-[length:var(--dc-cell-value-font-size,inherit)] break-words text-[color:var(--dc-cell-value-color,var(--dc-color-text-secondary))]',
          size === 'large' && 'text-[length:var(--dc-cell-large-value-font-size,inherit)]',
          valueClass,
        )
      "
    >
      <slot v-if="slots.value" name="value" />
      <slot v-else-if="slots.default" />
      <span v-else>{{ value }}</span>
    </div>

    <!-- right icon -->
    <div
      v-if="slots['right-icon'] || isLink"
      class="dc-cell__right-icon ml-[var(--dc-space-1)] h-[var(--dc-cell-line-height,var(--dc-line-height-md))] text-[length:var(--dc-cell-icon-size,16px)] leading-[var(--dc-cell-line-height,var(--dc-line-height-md))] text-[color:var(--dc-cell-right-icon-color,var(--dc-color-icon))]"
    >
      <slot v-if="slots['right-icon']" name="right-icon" />
      <span v-else class="dc-cell__arrow text-[18px] font-[200]">{{ renderArrowIcon }}</span>
    </div>

    <!-- extra slot -->
    <slot v-if="slots.extra" name="extra" />
  </component>
</template>