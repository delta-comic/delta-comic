<script setup lang="ts">
import { NScrollbar, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { showcaseEntryByPath, showcaseEntryBySlug } from '../../components/showcase/catalog'
import type { ShowcaseEntry } from '../../components/showcase/types'

const route = useRoute()
const fallbackPage: ShowcaseEntry = {
  name: 'Delta UI',
  label: 'Delta UI',
  description: '为 Delta Comic 构建的 Vue 组件。',
  group: '基础组件',
  slug: '',
  path: '',
  kind: 'component',
  tags: [],
  sections: [],
}

const pageInfo = computed(
  () =>
    showcaseEntryByPath.get(route.path) ??
    showcaseEntryBySlug.get(
      String((route.params as Record<string, string | string[]>).slug ?? ''),
    ) ??
    fallbackPage,
)
</script>

<template>
  <NScrollbar class="h-full!">
    <div class="mx-auto flex w-full max-w-[1440px] items-start">
      <article class="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
        <header class="mb-8 border-b border-[var(--nui-divider-color)] pb-7">
          <h1 class="text-3xl font-bold tracking-tight text-[var(--nui-text-color-1)] sm:text-4xl">
            {{ pageInfo.label }}
          </h1>
          <p class="mt-4 max-w-3xl text-base leading-7 text-[var(--nui-text-color-2)]">
            {{ pageInfo.description }}
          </p>
          <div v-if="pageInfo.tags.length" class="mt-5 flex flex-wrap gap-2">
            <NTag v-for="tag in pageInfo.tags" :key="tag" size="small" :bordered="false">
              {{ tag }}
            </NTag>
          </div>
        </header>

        <RouterView />
      </article>

      <aside class="sticky top-0 hidden w-56 shrink-0 px-6 py-12 2xl:block">
        <p class="mb-3 text-sm font-semibold text-[var(--nui-text-color-1)]">本页内容</p>
        <nav aria-label="本页内容" class="space-y-1 border-l border-[var(--nui-divider-color)]">
          <a
            v-for="section in pageInfo.sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="block border-l border-transparent px-4 py-1.5 text-sm text-[var(--nui-text-color-3)] no-underline transition-colors hover:border-[var(--nui-primary-color)] hover:text-[var(--nui-primary-color)]"
          >
            {{ section.label }}
          </a>
        </nav>
      </aside>
    </div>
  </NScrollbar>
</template>