<script setup lang='ts'>
import { onMounted, computed, watch, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ComponentExposed } from 'vue-component-type-helpers'
import { useTabStatus } from 'vant'
import { Comp, coreModule, requireDepend, Store, uni, Utils } from 'delta-comic-core'
import { usePluginStore } from '@/plugin/store'
import { fromPairs } from 'es-toolkit/compat'
import { decodeURIDeep, decodeURIComponentDeep } from '@/utils/url'
import { searchSourceKey } from './source'
const config = Store.useConfig().$load(Store.appConfig)
const temp = Store.useTemp().$applyRaw('searchConfig', () => ({
  result: new Map<string, Utils.data.RStream<uni.item.Item>>(),
  scroll: new Map<string, number>()
}))
const list = useTemplateRef<ComponentExposed<typeof Comp.List>>('list')
const $router = useRouter()
const $route = useRoute()
const $props = defineProps<{
  sort: string
  source: string
}>()



const input = decodeURIDeep($route.params.input.toString() ?? '')
const pluginStore = usePluginStore()
const method = computed(() => {
  const [plugin, name] = searchSourceKey.toJSON($props.source)
  return fromPairs(fromPairs(pluginStore.allSearchSource)[plugin])[name]
})
const comicStream = computed(() => {
  const storeKey = `${input}\u1145${$props.sort}\u1145${$props.source}`
  if (temp.result.has(storeKey)) return temp.result.get(storeKey)!
  const stream = method.value.getStream(decodeURIComponentDeep(decodeURIDeep(input)), $props.sort)
  temp.result.set(storeKey, stream)
  return stream
})

const dataProcessor = (data: uni.item.Item[]) => config.value.showAIProject ? data : data.filter(comic => !comic.$isAi)

const showSearch = defineModel<boolean>('showHeader', { required: true })
watch(() => list.value?.scrollTop, async (scrollTop, old) => {
  if (!scrollTop || !old) return
  if (scrollTop - old > 0) showSearch.value = false
  else showSearch.value = true
}, { immediate: true })

const setupScroll = () => {
  if (temp.scroll.has(input)) list.value?.listInstance?.scrollTo({ top: temp.scroll.get(input) })
}
const setScroll = () => {
  temp.scroll.set(input, list.value?.scrollTop!)
}
const isActive = useTabStatus()
if (isActive) {
  watch(isActive, isActive => {
    if (isActive) setupScroll()
    else setScroll()
  })
}
const stop = $router.beforeEach(() => {
  setScroll()
  stop()
})
onMounted(setupScroll)


const { comp } = requireDepend(coreModule)
const getItemCard = (contentType: uni.content.ContentType_) => uni.item.Item.itemCard.get(contentType) ?? comp.ItemCard
</script>

<template>
  <Comp.List :itemHeight="140" v-slot="{ data: { item } }" v-if="isActive ?? true"
    class="duration-200 will-change-[transform,_height] transition-all h-full" ref="list" :source="comicStream!"
    :data-processor>
    <component :is="getItemCard(item.contentType)" :item />
  </Comp.List>
</template>