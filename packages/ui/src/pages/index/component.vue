<script setup lang="ts">
import { NScrollbar, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface ComponentPageInfo {
  title: string
  description: string
  tags: string[]
}

const route = useRoute()
const pageDefinitions: Record<string, ComponentPageInfo> = {
  '//component/list': {
    title: 'List 列表',
    description: '用于大数据集的虚拟列表与响应式瀑布流，在有限的渲染成本下保持顺畅滚动。',
    tags: ['虚拟滚动', '异步数据', '响应式布局'],
  },
  '//component/message': {
    title: 'Message 消息',
    description: '面向异步流程的统一反馈实例，可在加载、成功、失败与主动销毁之间平滑切换。',
    tags: ['反馈', 'Promise', '响应式文本'],
  },
}

const pageInfo = computed<ComponentPageInfo>(
  () =>
    pageDefinitions[String(route.name)] ?? {
      title: 'Delta UI',
      description: '为 Delta Comic 构建的 Vue 组件。',
      tags: [],
    },
)
</script>

<template>
  <NScrollbar class="h-full!">
    <article class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
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
  </NScrollbar>
</template>