<script setup lang="ts">
import { Global } from '@delta-comic/plugin'
import { isEmpty } from 'es-toolkit/compat'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { Icons } from '@/icons'

const $router = useRouter()
const { t } = useI18n()
const hotList = computed(() =>
  Array.from(Global.mainLists.entries()).flatMap(([plugin, blocks]) =>
    blocks.map((block, blockIndex) => ({ block, blockIndex, plugin })),
  ),
)
const topButtons = computed(() => {
  const buttons = Array.from(Global.topButton.values()).flat()
  if (!isEmpty(Global.levelboard)) {
    buttons.unshift({
      bgColor: '#ff9212',
      name: t('home.ranking'),
      icon: Icons.other.HotLevel,
      onClick() {
        const first = Global.levelboard.keys().next().value!
        return $router.force.push({ name: '/hot/[plugin]', params: { plugin: first } })
      },
    })
  }
  return buttons
})
</script>

<template>
  <NScrollbar class="size-full">
    <div
      class="scrollbar flex h-fit w-full gap-8 overflow-x-auto overflow-y-hidden bg-(--dc-surface) px-4 py-1"
    >
      <div
        class="flex h-full w-fit flex-col items-center justify-around"
        v-for="(btn, buttonIndex) of topButtons"
        :key="`${btn.name}:${buttonIndex}`"
      >
        <button
          type="button"
          class="dc-interactive flex size-12 items-center justify-center rounded-full"
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
<style scoped lang="css">
.scrollbar::-webkit-scrollbar {
  display: none;
}

.scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>