<script setup lang="ts">
import { SourcedValue, uni } from '@delta-comic/model'
import { Global, usePluginStore } from '@delta-comic/plugin'
import { useRoute, useRouter } from 'vue-router'

const $router = useRouter()
const $route = useRoute<'/hot/[plugin]'>()
const pluginStore = usePluginStore()
const selectLevelKey = new SourcedValue<[plugin: string, name: string]>()

const plugin = $route.params.plugin
const select = $route.query.dfSel?.toString() ?? Global.levelboard.get(plugin)?.[0].name ?? ''
const selectLevel = selectLevelKey.stringify([plugin, select])

const source = Global.levelboard.get(plugin)?.find(v => v.name == select)

const getItemCard = (item: uni.item.Item) => uni.item.Item.itemCards.get(item.contentType)
const getColor = (index: number) => {
  if (index == 0) return 'rgb(255,215,0)'
  if (index == 1) return 'rgb(192,192,192)' // silver
  if (index == 2) return 'rgb(205,127,50)' // bronze
  if (index < 9) return 'var(--p-color)'
  return 'transparent'
}
const routeToLevel = (source: string) => {
  const [plugin, select] = selectLevelKey.parse(source)
  $router.force.replace({ name: '/hot/[plugin]', params: { plugin }, query: { dfSel: select } })
}
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
          :value="selectLevel"
          @update:value="(v: string) => routeToLevel(v)"
          placement="bottom-end"
          size="large"
        >
          <NButton text>
            <span class="text-xs text-(--nui-primary-color)">
              <DcVar :value="selectLevelKey.toJSON(selectLevel)" v-slot="{ value: [plugin, name] }">
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
        :source="{ type: 'query', value: source.content() }"
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