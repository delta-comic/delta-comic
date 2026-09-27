<script setup lang="ts">
import { usePluginStore } from '@delta-comic/plugin'
import { isEmpty } from 'es-toolkit/compat'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { Icons } from '@/icons'

const $router = useRouter()
const { t } = useI18n()
const pluginStore = usePluginStore()
const leaderboards = computed(() =>
  pluginStore
    .modelEntries('content')
    .flatMap(([plugin, content]) =>
      (content.promotes?.hotPageContent?.levelboard ?? []).map(value => ({ plugin, value })),
    ),
)
const hotList = computed(() =>
  pluginStore
    .modelEntries('content')
    .flatMap(([plugin, content]) =>
      (content.promotes?.hotPageContent?.categories ?? []).map((category, blockIndex) => ({
        block: {
          ...category,
          onClick: () => pluginStore.plugins.get(plugin)?.hooks?.onHotCategoryClick?.(category),
        },
        blockIndex,
        plugin,
      })),
    ),
)
const topButtons = computed(() => {
  const buttons = pluginStore
    .modelEntries('content')
    .flatMap(([plugin, content]) =>
      (content.promotes?.hotPageContent?.topButton ?? []).map(button => ({
        ...button,
        onClick: () => pluginStore.plugins.get(plugin)?.hooks?.onHotTopButtonClick?.(button),
      })),
    )
  if (!isEmpty(leaderboards.value)) {
    buttons.unshift({
      bgColor: '#ff9212',
      name: t('home.ranking'),
      icon: Icons.other.HotLevel,
      onClick() {
        void $router.force.push({
          name: '/hot/[plugin]',
          params: { plugin: leaderboards.value[0].plugin },
        })
      },
    })
  }
  return buttons
})
</script>

<template>
  <NScrollbar class="size-full">
    <div
      class="dc-scrollbar-hidden flex h-fit w-full gap-8 overflow-x-auto overflow-y-hidden bg-(--dc-surface) px-4 py-1"
    >
      <div
        class="flex h-full w-fit flex-col items-center justify-around"
        v-for="(btn, buttonIndex) of topButtons"
        :key="`${btn.name}:${buttonIndex}`"
      >
        <button
          type="button"
          class="flex size-12 dc-interactive items-center justify-center rounded-full"
          :aria-label="btn.name"
          :style="{ backgroundColor: btn.bgColor }"
          @click="btn.onClick?.()"
        >
          <NIcon color="white" size="calc(var(--spacing) * 6.5)">
            <component :is="btn.icon" />
          </NIcon>
        </button>
        <div class="text-[13px]!">{{ btn.name }}</div>
      </div>
    </div>
    <HotMainListBlock
      v-for="entry of hotList"
      :key="`${entry.plugin}:${entry.block.name}:${entry.blockIndex}`"
      v-bind="entry"
    >
      <template #arrow><Icons.material.ArrowForwardIosRound /></template>
    </HotMainListBlock>
  </NScrollbar>
</template>