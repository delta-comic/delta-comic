<script setup lang="ts">
import { SourcedValue, uni } from '@delta-comic/model'
import { Global, usePluginStore } from '@delta-comic/plugin'
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const $router = useRouter()
const $route = useRoute<'/hot/[plugin]'>()
const pluginStore = usePluginStore()
const { t } = useI18n()
const selectLevelKey = new SourcedValue<[plugin: string, name: string]>()

const plugin = computed(() => $route.params.plugin.toString())
const select = computed(
  () => $route.query.dfSel?.toString() ?? Global.levelboard.get(plugin.value)?.[0]?.name ?? '',
)
const selectLevel = computed(() => selectLevelKey.stringify([plugin.value, select.value]))
const source = computed(() =>
  Global.levelboard.get(plugin.value)?.find(v => v.name == select.value),
)
const items = useQuery({
  key: () => ['hot-levelboard', plugin.value, select.value],
  query: async ({ signal }) => (source.value ? await source.value.content(signal) : []),
})

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
  <div class="size-full bg-(--dc-background)">
    <div
      class="box-content flex h-(--dc-page-header-height) items-center bg-(--dc-surface) px-4 pt-safe"
    >
      <NPageHeader class="w-full" :title="t('home.ranking')" @back="$router.back()">
        <template #extra>
          <NPopselect
            :options="
              Array.from(Global.levelboard.entries()).map(([plugin, sources]) => ({
                type: 'group',
                label: plugin,
                children: sources.map(s => ({
                  label: s.name,
                  value: selectLevelKey.toString([plugin, s.name]),
                })),
              }))
            "
            :value="selectLevel"
            @update:value="(v: string) => routeToLevel(v)"
            placement="bottom-end"
            size="large"
          >
            <NButton text>
              <span class="text-xs text-(--nui-primary-color)">
                <DcVar
                  :value="selectLevelKey.toJSON(selectLevel)"
                  v-slot="{ value: [plugin, name] }"
                >
                  {{ pluginStore.$getI18nName(plugin) }}:{{ name }}
                </DcVar>
              </span>
            </NButton>
          </NPopselect>
        </template>
      </NPageHeader>
    </div>
    <div
      class="mx-auto h-[calc(100%-var(--dc-page-header-height)-var(--safe-area-inset-top))] w-full max-w-6xl"
    >
      <DcList
        v-if="source"
        :source="{ type: 'query', value: items }"
        :minHeight="140"
        v-slot="{ item, index, height }"
        class="size-full!"
      >
        <div :style="{ height: `${height}px` }" class="relative w-full overflow-hidden">
          <component :is="getItemCard(item)" :item :style="{ height: `${height}px` }" />
          <div
            :style="{ '--color': getColor(index) }"
            class="absolute right-0 bottom-0 z-0 translate-x-1/6 translate-y-1/4 text-[clamp(5rem,14vw,12rem)] font-bold text-(--color) italic opacity-20"
          >
            #{{ index + 1 }}
          </div>
        </div>
      </DcList>
    </div>
  </div>
</template>