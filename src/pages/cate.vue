<script setup lang="ts">
import { SharedFunction } from '@delta-comic/core'
import { Global, usePluginStore } from '@delta-comic/plugin'


const pluginStore = usePluginStore()
</script>

<template>
  <div class="size-full bg-(--van-background)">
    <VanNavBar title="全部分类" left-arrow @click-left="$router.back()" class="pt-safe" />
    <NScrollbar class="h-[calc(100%-var(--van-nav-bar-height)-var(--safe-area-inset-top))]!">
      <div v-for="[plugin, categories] in Global.categories.entries()">
        <NH1 prefix="bar" align-text type="success" class="mb-0! ml-2!">
          <NText type="primary">
            {{ pluginStore.$getPluginDisplayName(plugin) }}
          </NText>
        </NH1>
        <div
          v-for="[namespace, category] in Object.entries(
            Object.groupBy(categories, v => v.namespace)
          )"
          class="mx-auto mb-2 w-[calc(100%-8px)] rounded-2xl bg-(--van-background-2) py-3"
        >
          <div class="mb-2 pl-5 text-xl" v-if="namespace">{{ namespace }}</div>
          <div v-if="category" class="flex flex-wrap gap-3 px-2">
            <NButton
              ghost
              v-for="cate in category"
              @click="
                SharedFunction.call(
                  'routeToSearch',
                  cate.search.input,
                  [plugin, cate.search.methodId],
                  cate.search.sort
                )
              "
            >
              {{ cate.title }}
            </NButton>
          </div>
        </div>
      </div>
    </NScrollbar>
  </div>
</template>