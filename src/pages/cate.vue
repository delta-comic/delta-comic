<script setup lang='ts'>
import { usePluginStore } from '@/plugin/store'
import { uni, Utils } from 'delta-comic-core'

const pluginStore = usePluginStore()
</script>

<template>
  <div class="size-full bg-(--van-background)">
    <VanNavBar title="全部分类" left-arrow @click-left="$router.back()" class="pt-safe" />
    <NScrollbar class="h-[calc(100%-var(--van-nav-bar-height)-var(--safe-area-inset-top))]!">
      <div v-for="[plugin, categories] in uni.content.ContentPage.categories.entries()">
        <NH1 prefix="bar" align-text type="success" class="ml-2! mb-0!">
          <NText type="primary">
            {{ pluginStore.$getPluginDisplayName(plugin) }}
          </NText>
        </NH1>
        <div v-for="[namespace, category] in Object.entries(Object.groupBy(categories, v => v.namespace))"
          class="bg-(--van-background-2) py-3 rounded-2xl w-[calc(100%-8px)] mx-auto mb-2">
          <div class="pl-5 text-xl mb-2" v-if="namespace">{{ namespace }}</div>
          <div v-if="category" class="flex flex-wrap gap-3 px-2">
            <NButton ghost v-for="cate in category"
              @click="Utils.eventBus.SharedFunction.call('routeToSearch', cate.search.input, [plugin, cate.search.methodId], cate.search.sort)">
              {{ cate.title }}
            </NButton>
          </div>
        </div>
      </div>
    </NScrollbar>
  </div>
</template>