<script
  setup
  lang="ts"
  generic="
    T extends {
      name: string
      title: string
      route: RouteLocationRaw
    }
  "
>
import { Mutex } from 'es-toolkit'
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import type { StyleProps } from '../utils'

const $props = withDefaults(
  defineProps<
    {
      /**
       * 基于路由的name匹配
       */
      items: T[]
      mode?: 'replace' | 'push'
    } & StyleProps
  >(),
  {
    mode: 'replace'
  }
)

const $route = useRoute()
const $router = useRouter()

const selecting = computed(() => {
  const item = $props.items.find(v => {
    const route = $router.resolve(v.route)
    return route.path == $route.path
  })
  return item?.name ?? $props.items.at(0)?.name
})

const routeLock = new Mutex()
const handleRoute = async (aimName: string) => {
  if (routeLock.isLocked) return false
  try {
    const item = $props.items.find(v => v.name == aimName)
    if (!item) throw new Error('Not found item in <DcRouterTab>, name: ' + aimName)

    await $router.force[$props.mode](item.route)
    return true
  } finally {
    routeLock.release()
  }
}

defineSlots<{ left(): any; right(): any; bottom(): any }>()
</script>

<template>
  <VanTabs
    ref="tab"
    shrink
    :active="selecting"
    :beforeChange="handleRoute"
    :class="twMerge('w-full', $props.class)"
    :style
  >
    <template #nav-left>
      <slot name="left"></slot>
    </template>
    <template #nav-right>
      <slot name="right"></slot>
    </template>
    <template #nav-bottom>
      <slot name="bottom"></slot>
    </template>
    <VanTab
      v-for="item of items"
      :title="item.title"
      @click="handleRoute(item.name)"
      :name="item.name"
    >
    </VanTab>
  </VanTabs>
</template>