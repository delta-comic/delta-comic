<script setup lang="ts">
import { Global, usePluginStore } from '@delta-comic/plugin'
import { SharedFunction } from '@delta-comic/utils'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const $router = useRouter()
const pluginStore = usePluginStore()
const { t } = useI18n()
</script>

<template>
  <div class="size-full bg-(--dc-background)">
    <div
      class="box-content flex h-(--dc-page-header-height) items-center bg-(--dc-surface) px-4 pt-safe"
    >
      <NPageHeader class="w-full" :title="t('category.all')" @back="$router.back()" />
    </div>
    <NScrollbar class="h-[calc(100%-var(--dc-page-header-height)-var(--safe-area-inset-top))]!">
      <div class="mx-auto w-full max-w-6xl py-2">
        <div v-for="[plugin, categories] in Global.categories.entries()" :key="plugin">
          <NH1 prefix="bar" align-text type="success" class="mb-0! ml-2!">
            <NText type="primary">
              {{ pluginStore.$getI18nName(plugin) }}
            </NText>
          </NH1>
          <div
            v-for="[namespace, category] in Object.entries(
              Object.groupBy(categories, v => v.namespace),
            )"
            :key="namespace"
            class="mx-auto mb-2 w-[calc(100%-8px)] rounded-2xl bg-(--dc-surface) py-3"
          >
            <div class="mb-2 pl-5 text-xl" v-if="namespace">{{ namespace }}</div>
            <div v-if="category" class="flex flex-wrap gap-3 px-2">
              <NButton
                ghost
                v-for="cate in category"
                :key="cate.title"
                @click="
                  SharedFunction.call(
                    'routeToSearch',
                    cate.search.input,
                    [plugin, cate.search.methodId],
                    cate.search.sort,
                  )
                "
              >
                {{ cate.title }}
              </NButton>
            </div>
          </div>
        </div>
      </div>
    </NScrollbar>
  </div>
</template>