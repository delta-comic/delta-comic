<script setup lang="ts">
import { NDrawer, NDrawerContent } from 'naive-ui'
import { computed, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { name, version } from '../../package.json'
import { showcaseEntries } from '../components/showcase/catalog'
import ShowcaseHeader from '../components/showcase/ShowcaseHeader.vue'
import ShowcaseSidebar from '../components/showcase/ShowcaseSidebar.vue'
import type { ShowcaseNavItem } from '../components/showcase/types'

const route = useRoute()
const router = useRouter()
const navigationOpen = shallowRef(false)
const searchKeyword = shallowRef('')

const componentNavigation = computed<ShowcaseNavItem[]>(() => [...showcaseEntries])
const activePath = computed(() => route.path)

async function handleNavigate(item: ShowcaseNavItem) {
  navigationOpen.value = false
  if (route.path !== item.path) await router.push(item.path)
}
</script>

<template>
  <div
    class="flex h-dvh min-w-80 flex-col bg-[var(--nui-body-color)]"
    style="--p-color: var(--nui-primary-color)"
  >
    <ShowcaseHeader
      v-model:keyword="searchKeyword"
      :package-name="name"
      :version
      @open-navigation="navigationOpen = true"
    />

    <div class="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1">
      <aside
        class="hidden w-64 shrink-0 border-r border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] lg:block"
      >
        <ShowcaseSidebar
          v-model:keyword="searchKeyword"
          :items="componentNavigation"
          :active-path="activePath"
          @select="handleNavigate"
        />
      </aside>

      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>

    <NDrawer v-model:show="navigationOpen" placement="left" :width="288">
      <NDrawerContent title="组件导航" closable body-content-class="p-0!">
        <ShowcaseSidebar
          v-model:keyword="searchKeyword"
          :items="componentNavigation"
          :active-path="activePath"
          @select="handleNavigate"
        />
      </NDrawerContent>
    </NDrawer>
  </div>
</template>