<script setup lang="ts">
import { NResult } from 'naive-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { componentEntries } from '../../../components/showcase/catalog'
import { getShowcaseDemo } from '../../../components/showcase/demoModules'

const route = useRoute()
const routeSlug = computed(() =>
  String((route.params as Record<string, string | string[]>).slug ?? ''),
)
const entry = computed(() => componentEntries.find(item => item.slug === routeSlug.value))
const DemoComponent = computed(() => (entry.value ? getShowcaseDemo(entry.value.name) : undefined))
</script>

<template>
  <Suspense v-if="DemoComponent">
    <component :is="DemoComponent" />
    <template #fallback>
      <div class="flex min-h-64 items-center justify-center text-sm text-[var(--nui-text-color-3)]">
        正在加载组件示例…
      </div>
    </template>
  </Suspense>
  <NResult
    v-else
    status="404"
    title="未找到组件"
    description="这个组件条目不存在，或暂时没有可用的演示。"
  />
</template>