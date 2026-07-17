<script setup lang="ts">
import { delay } from 'es-toolkit'
import { NAlert, NButton, NInput } from 'naive-ui'
import { onScopeDispose, shallowRef } from 'vue'

import { createLoadingMessage, type LoadingInstance } from '@/message'

import DemoSection from '../../../components/showcase/DemoSection.vue'

const messageInstance = shallowRef<LoadingInstance>()
const isActive = shallowRef(false)
const isRunningTask = shallowRef(false)
const loadingText = shallowRef('正在同步阅读记录…')
const successText = shallowRef('同步完成')
const failText = shallowRef('同步失败，请稍后重试')

function replaceMessage() {
  messageInstance.value?.destroy()
  const instance = createLoadingMessage(loadingText)
  messageInstance.value = instance
  isActive.value = true
  return instance
}

async function settleMessage(type: 'success' | 'fail') {
  const instance = messageInstance.value
  if (!instance) return

  await instance[type](type === 'success' ? successText.value : failText.value, 900)
  if (messageInstance.value === instance) {
    messageInstance.value = undefined
    isActive.value = false
  }
}

function destroyMessage() {
  messageInstance.value?.destroy()
  messageInstance.value = undefined
  isActive.value = false
}

async function runBoundTask() {
  if (isRunningTask.value) return
  isRunningTask.value = true
  const instance = replaceMessage()

  try {
    await instance.bind(delay(1200), false, successText.value, failText.value)
    await delay(600)
  } finally {
    if (messageInstance.value === instance) {
      messageInstance.value = undefined
      isActive.value = false
    }
    isRunningTask.value = false
  }
}

onScopeDispose(destroyMessage)
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="controlled-message"
      title="可控状态消息"
      description="创建一个持续展示的 loading，再将同一个实例更新为成功或失败状态。"
    >
      <div
        class="rounded-lg border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] p-4 sm:p-5"
      >
        <div class="grid gap-4 md:grid-cols-3">
          <label class="space-y-2">
            <span class="block text-xs font-medium text-[var(--nui-text-color-2)]">加载文本</span>
            <NInput v-model:value="loadingText" placeholder="加载中的提示" />
          </label>
          <label class="space-y-2">
            <span class="block text-xs font-medium text-[var(--nui-text-color-2)]">成功文本</span>
            <NInput v-model:value="successText" placeholder="成功提示" />
          </label>
          <label class="space-y-2">
            <span class="block text-xs font-medium text-[var(--nui-text-color-2)]">失败文本</span>
            <NInput v-model:value="failText" placeholder="失败提示" />
          </label>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <NButton type="primary" @click="replaceMessage">创建消息</NButton>
          <NButton :disabled="!isActive" type="success" @click="settleMessage('success')">
            标记成功
          </NButton>
          <NButton :disabled="!isActive" type="error" @click="settleMessage('fail')">
            标记失败
          </NButton>
          <NButton :disabled="!isActive" secondary @click="destroyMessage">立即销毁</NButton>
        </div>
      </div>
      <template #note>传入 shallowRef 后，修改加载文本会实时同步到当前消息实例。</template>
    </DemoSection>

    <DemoSection
      section-id="bound-task"
      title="绑定异步任务"
      description="bind 会跟随 Promise 的最终状态更新反馈，并保留标准的错误传播行为。"
    >
      <div class="space-y-4">
        <NAlert type="info" :bordered="false">
          此示例模拟一个 1.2 秒的任务。执行期间按钮会锁定，完成后消息自动转为成功状态。
        </NAlert>
        <NButton type="primary" :loading="isRunningTask" @click="runBoundTask">
          {{ isRunningTask ? '任务执行中' : '运行异步任务' }}
        </NButton>
      </div>
      <template #note
        >使用 throwError=false 可以在界面流程中消费失败状态；默认模式仍会抛出原错误。</template
      >
    </DemoSection>
  </div>
</template>