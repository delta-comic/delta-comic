<script setup lang="ts">
import { NDrawer, NDrawerContent } from 'naive-ui'
import { computed, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { name, version } from '../../package.json'
import ShowcaseHeader from '../components/showcase/ShowcaseHeader.vue'
import ShowcaseSidebar from '../components/showcase/ShowcaseSidebar.vue'
import type { ShowcaseNavItem } from '../components/showcase/types'

const route = useRoute()
const router = useRouter()
const navigationOpen = shallowRef(false)
const searchKeyword = shallowRef('')

const navigationDefinitions: Record<string, Pick<ShowcaseNavItem, 'label' | 'description'>> = {
  '//component/list': { label: 'List 列表', description: '高性能虚拟滚动' },
  '//component/message': { label: 'Message 消息', description: '异步任务状态反馈' },
}

const componentNavigation = computed<ShowcaseNavItem[]>(() =>
  router
    .getRoutes()
    .filter(item => typeof item.name === 'string' && item.name.startsWith('//component/'))
    .map(item => ({
      name: String(item.name),
      path: item.path,
      label: navigationDefinitions[String(item.name)]?.label ?? String(item.name),
      description: navigationDefinitions[String(item.name)]?.description ?? 'Delta UI 组件',
    }))
    .sort(
      (left, right) =>
        Object.keys(navigationDefinitions).indexOf(left.name) -
        Object.keys(navigationDefinitions).indexOf(right.name),
    ),
)

const activeName = computed(() => String(route.name ?? ''))

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
          :active-name="activeName"
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
          :active-name="activeName"
          @select="handleNavigate"
        />
      </NDrawerContent>
    </NDrawer>
  </div>
</template>