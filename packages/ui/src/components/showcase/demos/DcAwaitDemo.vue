<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'
import { shallowRef } from 'vue'

import { DcAwait } from '@/index'

import DemoSection from '../DemoSection.vue'

const automaticRuns = shallowRef(0)
const manualRuns = shallowRef(0)

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration))
const loadAutomatic = async () => {
  await wait(450)
  automaticRuns.value++
  return `自动结果 #${automaticRuns.value}`
}
const loadManual = async () => {
  await wait(300)
  manualRuns.value++
  return { id: manualRuns.value, title: `手动结果 #${manualRuns.value}` }
}
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="await-auto"
      title="自动执行 Promise"
      description="autoLoad 为 true 时，组件挂载后立即调用 promise，并把结果交给作用域插槽。"
    >
      <DcAwait :promise="loadAutomatic" auto-load>
        <template #default="{ result, load }">
          <div
            class="flex min-h-32 flex-col items-center justify-center gap-4 rounded-lg bg-[var(--nui-card-color)] p-6"
          >
            <NTag :type="result ? 'success' : 'warning'">{{ result ?? '等待异步结果…' }}</NTag>
            <NButton size="small" secondary type="primary" @click="load">重新执行</NButton>
          </div>
        </template>
      </DcAwait>
    </DemoSection>

    <DemoSection
      section-id="await-manual"
      title="手动执行与结构化结果"
      description="关闭 autoLoad 后由插槽中的 load 决定执行时机，并可消费任意结果类型。"
    >
      <DcAwait :promise="loadManual">
        <template #default="{ result, load }">
          <div
            class="flex min-h-32 flex-col items-center justify-center gap-4 rounded-lg bg-[var(--nui-card-color)] p-6"
          >
            <p class="text-sm text-[var(--nui-text-color-2)]">
              {{ result ? `${result.title}（id: ${result.id}）` : '尚未请求数据' }}
            </p>
            <NButton type="primary" @click="load">{{ result ? '再次加载' : '开始加载' }}</NButton>
          </div>
        </template>
      </DcAwait>
    </DemoSection>
  </div>
</template>