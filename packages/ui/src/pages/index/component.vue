<script setup lang="ts">
import { NScrollbar, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface ComponentPageInfo {
  title: string
  description: string
  tags: string[]
  sections: { id: string; label: string }[]
}

const route = useRoute()
const pageDefinitions: Record<string, ComponentPageInfo> = {
  '//component/list': {
    title: 'List 列表',
    description: '用于大数据集的虚拟列表与响应式瀑布流，在有限的渲染成本下保持顺畅滚动。',
    tags: ['虚拟滚动', '异步数据', '响应式布局'],
    sections: [
      { id: 'basic-list', label: '基础列表' },
      { id: 'responsive-waterfall', label: '响应式瀑布流' },
    ],
  },
  '//component/message': {
    title: 'Message 消息',
    description: '面向异步流程的统一反馈实例，可在加载、成功、失败与主动销毁之间平滑切换。',
    tags: ['反馈', 'Promise', '响应式文本'],
    sections: [
      { id: 'controlled-message', label: '可控状态消息' },
      { id: 'bound-task', label: '绑定异步任务' },
    ],
  },
}

const pageInfo = computed<ComponentPageInfo>(
  () =>
    pageDefinitions[String(route.name)] ?? {
      title: 'Delta UI',
      description: '为 Delta Comic 构建的 Vue 组件。',
      tags: [],
      sections: [],
    },
)
</script>

<template>
  <NScrollbar class="h-full!">
    <div class="mx-auto flex w-full max-w-[1440px] items-start">
      <article class="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
        <header class="mb-8 border-b border-[var(--nui-divider-color)] pb-7">
          <h1 class="text-3xl font-bold tracking-tight text-[var(--nui-text-color-1)] sm:text-4xl">
            {{ pageInfo.title }}
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