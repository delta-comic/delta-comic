<script setup lang="ts">
import UnitCard from '@/components/unitCard.vue'
import { useTemp } from '@delta-comic/core'
import { PromiseContent, SourcedValue, Stream, uni, type RPromiseContent, type RStream } from '@delta-comic/model'
import { Global, usePluginStore } from '@delta-comic/plugin'
import { DcVar } from '@delta-comic/ui'
import { isArray } from 'es-toolkit/compat'
import { computed, markRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const $router = useRouter()
const $route = useRoute<'/hot'>()
const plugin = computed(() => $route.query.plugin?.toString() ?? '')
const sourceList = computed(() => Global.levelboard.get(plugin.value))

const selectLevelKey = new SourcedValue<[plugin: string, name: string]>()

const temp = useTemp().$apply('level', () => ({
  selectLevel: selectLevelKey.toString([
    plugin.value,
    (isArray($route.query.dfSel) ? $route.query.dfSel[0] : $route.query.dfSel) ??
      sourceList.value?.[0].name ??
      ''
  ]),
  list: markRaw(
    new Map<
      string,
      RStream<uni.item.Item> | RPromiseContent<any, uni.item.Item[]>
    >()
  )
}))
watch(
  () => temp.selectLevel,
  (selectLevel, oldSelectLevel) => {
    const [plugin, select] = selectLevelKey.toJSON(selectLevel)
    const [oldPlugin] = selectLevelKey.toJSON(oldSelectLevel)
    if (plugin != oldPlugin)
      return $router.force.replace({ name: '/hot', query: { plugin, dfSel: select } })
  }
)
const source = computed(() => {
  if (!temp.list.has(temp.selectLevel)) {
    const [plugin, name] = selectLevelKey.toJSON(temp.selectLevel)
    const s = sourceList.value?.find(v => v.name == name)?.content()
    if (!s)
      return {
        data: PromiseContent.fromPromise(
          Promise.reject(`Can not found named: "${name}" in ${plugin}`)
        ),
        isEnd: true
      }
    temp.list.set(temp.selectLevel, s)
  }
  const s = temp.list.get(temp.selectLevel)!
  return Stream.isStream(s) ? s : { data: s, isEnd: true }
})

const getItemCard = (item: uni.item.Item) =>
  uni.item.Item.itemCard.get(item.contentType) ?? UnitCard

const getColor = (index: number) => {
  if (index == 0) {
    return 'rgb(255,215,0)'
  }
  if (index == 1) {
    return 'rgb(192,192,192)' // silver
  }
  if (index == 2) {
    return 'rgb(205,127,50)' // bronze
  }
  if (index < 9) {
    return 'var(--p-color)'
  }
  return 'transparent'
}
const pluginStore = usePluginStore()
</script>

<template>
  <div class="size-full">
    <VanNavBar title="排行榜" left-arrow @click-left="$router.back()" class="pt-safe">
      <template #right>
        <NPopselect
          :options="
            Array.from(Global.levelboard.entries()).map(([plugin, sources]) => ({
              type: 'group',
              label: plugin,
              children: sources.map(s => ({
                label: s.name,
                value: selectLevelKey.toString([plugin, s.name])
              }))
            }))
          "
          v-model:value="temp.selectLevel"
          placement="bottom-end"
          size="large"
        >
          <NButton text>
            <span class="text-xs text-(--nui-primary-color)">
              <DcVar
                :value="selectLevelKey.toJSON(temp.selectLevel)"
                v-slot="{ value: [plugin, name] }"
              >
                {{ pluginStore.$getPluginDisplayName(plugin) }}:{{ name }}
              </DcVar>
            </span>
          </NButton>
        </NPopselect>
      </template>
    </VanNavBar>
    <div class="h-[calc(100%-46px)] w-full">
      <DcList
        v-if="source"
        :source
        :item-height="140"
        v-slot="{ data: { item, index }, height }"
        class="size-full!"
      >
        <div :style="{ height: `${height}px` }" class="relative w-full overflow-hidden">
          <component :is="getItemCard(item)" :item :style="{ height: `${height}px` }" />
          <div
            :style="{ '--color': getColor(index) }"
            class="absolute right-0 bottom-0 z-0 translate-x-1/6 translate-y-1/4 text-[20vw] font-bold text-(--color) italic opacity-20"
          >
            #{{ index + 1 }}
          </div>
        </div>
      </DcList>
    </div>
  </div>
</template>