<script setup lang="ts">
import { usePluginStore } from '@/plugin/store'
import type { PluginUserActionPage } from 'delta-comic-core'
import { NGi, NGrid } from 'naive-ui'
import { toRef } from 'vue'
defineProps<{ card: PluginUserActionPage; pluginName: string; color?: string }>()
const pluginStore = usePluginStore()
</script>

<template>
  <div class="flex min-h-20 w-full flex-col">
    <div class="w-full pl-4 text-lg font-semibold">
      {{ card.title }}
      <span class="text-[16px] text-(--van-text-color-3) italic"
        >#{{ pluginStore.$getPluginDisplayName(pluginName) }}</span
      >
    </div>
    <NGrid class="w-full" :cols="4" :y-gap="10">
      <template v-for="item of card.items">
        <NGi
          class="van-haptics-feedback flex flex-col items-center justify-center"
          v-if="item.type == 'button'"
          @click="
            $router.force.push({
              name: '/user/action/[plugin]/[key]',
              params: { plugin: pluginName, key: item.key }
            })
          "
          span="1"
        >
          <NIcon size="2rem" :color="color || 'var(--bili-blue)'">
            <component :is="item.icon" />
          </NIcon>
          <span class="mt-1 text-(--van-text-color)">{{ item.name }}</span>
        </NGi>
        <NGi
          class="van-haptics-feedback flex flex-col items-center justify-center"
          v-else-if="item.type == 'statistic'"
          span="1"
        >
          <NStatistic :label="item.name" :value="toRef(item.value).value">
            <template #prefix>
              <NIcon size="2rem" :color="color || 'var(--bili-blue)'" v-if="item.icon">
                <component :is="item.icon" />
              </NIcon>
            </template>
          </NStatistic>
        </NGi>
      </template>
    </NGrid>
  </div>
</template>