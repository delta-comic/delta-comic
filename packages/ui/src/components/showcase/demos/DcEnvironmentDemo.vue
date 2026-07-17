<script setup lang="ts">
import { NButton, NSwitch, NTag } from 'naive-ui'
import { defineComponent, h, markRaw, onScopeDispose, shallowRef } from 'vue'

import { addEnvironment, DcEnvironment } from '@/index'

import DemoSection from '../DemoSection.vue'

const showOptional = shallowRef(true)

const Banner = markRaw(
  defineComponent({
    props: { label: { type: String, required: true }, tone: { type: String, default: 'primary' } },
    setup(props) {
      return () =>
        h(
          'div',
          {
            class:
              props.tone === 'success'
                ? 'rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300'
                : 'rounded-lg border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-700 dark:text-sky-300',
          },
          props.label,
        )
    },
  }),
)

const Badge = markRaw(
  defineComponent({
    props: { label: { type: String, required: true }, tone: String },
    setup(props) {
      return () =>
        h(NTag, { bordered: false, type: 'warning' }, { default: () => `异步条件：${props.label}` })
    },
  }),
)

const disposers = [
  addEnvironment('showcase-banner', Banner as any, () => true, 'ui-showcase'),
  addEnvironment(
    'showcase-banner',
    Banner as any,
    (args: any) => args.tone === 'success',
    'ui-showcase',
  ),
  addEnvironment(
    'showcase-badge',
    Badge as any,
    async () => {
      await Promise.resolve()
      return showOptional.value
    },
    'ui-showcase',
  ),
]
onScopeDispose(() => disposers.forEach(dispose => dispose()))
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-2">
    <DemoSection
      section-id="environment-register"
      title="同一扩展点注册多个组件"
      description="DcEnvironment 会按注册顺序渲染所有条件成立的组件，并把 args 透传给它们。"
    >
      <div class="grid gap-3 rounded-lg bg-[var(--nui-card-color)] p-5">
        <DcEnvironment
          name="showcase-banner"
          :args="{ label: '基础注册：始终显示', tone: 'primary' } as any"
        />
        <DcEnvironment
          name="showcase-banner"
          :args="{ label: '条件注册：tone 为 success 时显示两项', tone: 'success' } as any"
        />
      </div>
      <template #note>示例在组件卸载时注销全部注册，避免 HMR 或多次进入页面后累积。</template>
    </DemoSection>

    <DemoSection
      section-id="environment-condition"
      title="异步条件与动态参数"
      description="condition 可以返回 Promise；改变依赖后重新挂载环境即可观察是否匹配。"
    >
      <template #actions>
        <div class="flex items-center gap-2 text-xs text-[var(--nui-text-color-3)]">
          启用条件 <NSwitch v-model:value="showOptional" size="small" />
        </div>
      </template>
      <div
        class="flex min-h-32 flex-col items-center justify-center gap-4 rounded-lg bg-[var(--nui-card-color)] p-5"
      >
        <DcEnvironment
          :key="String(showOptional)"
          name="showcase-badge"
          :args="{ label: showOptional ? '已通过' : '未通过', tone: 'warning' } as any"
        />
        <NButton size="small" secondary @click="showOptional = !showOptional">切换条件</NButton>
        <p v-if="!showOptional" class="text-xs text-[var(--nui-text-color-3)]">
          当前条件返回 false，因此扩展点为空。
        </p>
      </div>
    </DemoSection>
  </div>
</template>