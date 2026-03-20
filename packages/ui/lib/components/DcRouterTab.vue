<script
  setup
  lang="ts"
  generic="T extends { name: string; title: string; queries?: Record<string, string> }"
>
import { onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
const $props = defineProps<{ items: T[]; routerBase: string }>()
const $route = useRoute()
const defaultRouter = decodeURI($route.path.replaceAll($props.routerBase + '/', '').split('/')[0])
const select = ref(defaultRouter)
defineSlots<{ default(arg: { itemName: T }): any; left(): any; right(): any; bottom(): any }>()
const $router = useRouter()
const beforeChange = async (aim: string) => {
  let queryString = '?'
  const aimItem = $props.items.find(v => v.name == aim)!
  for (const key in aimItem.queries ?? {}) {
    if (Object.prototype.hasOwnProperty.call(aimItem.queries ?? {}, key)) {
      const value = (aimItem.queries ?? {})[key]
      queryString += `${key}=${value}&`
    }
  }
  queryString = queryString.replace(/&$/, '')
  await $router.force.replace(
    `${$props.routerBase}/${aim.split('/').map(encodeURI).join('/')}${queryString}`
  )
  return true
}
watch(
  () => $props.items,
  items => {
    if (!items.find(v => v.name.startsWith(select.value))) {
      console.log(select.value, items)
      // beforeChange(items[0].name)
    }
  }
)
const stop = $router.afterEach(to => {
  if (to.path.startsWith($props.routerBase)) {
    const aim = to.path.replaceAll($props.routerBase + '/', '').split('/')[0]
    if (aim !== select.value) {
      select.value = aim
    }
  }
})
onUnmounted(() => {
  stop()
})
</script>

<template>
  <VanTabs ref="tab" shrink v-model:active="select" :beforeChange class="w-full">
    <template #nav-left>
      <slot name="left"></slot>
    </template>
    <template #nav-right>
      <slot name="right"></slot>
    </template>
    <template #nav-bottom>
      <slot name="bottom"></slot>
    </template>
    <VanTab v-for="item of items" :title="item.title" @click="select = item.name" :name="item.name">
    </VanTab>
  </VanTabs>
</template>