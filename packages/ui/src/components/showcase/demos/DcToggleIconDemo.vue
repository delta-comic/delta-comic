<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'
import { h, shallowRef } from 'vue'

import { DcToggleIcon } from '@/index'

import DemoSection from '../DemoSection.vue'

const HeartIcon = () =>
  h('svg', { 'viewBox': '0 0 24 24', 'fill': 'currentColor', 'aria-hidden': 'true' }, [
    h('path', { d: 'M12 21s-8-4.7-8-11a4.8 4.8 0 0 1 8-3.6A4.8 4.8 0 0 1 20 10c0 6.3-8 11-8 11Z' }),
  ])

const BookmarkIcon = () =>
  h('svg', { 'viewBox': '0 0 24 24', 'fill': 'currentColor', 'aria-hidden': 'true' }, [
    h('path', { d: 'M6 3a2 2 0 0 0-2 2v17l8-4 8 4V5a2 2 0 0 0-2-2H6Z' }),
  ])

const favorite = shallowRef(false)
const bookmarked = shallowRef(true)
const lastEvent = shallowRef('尚未操作')
const controlledIntent = shallowRef<boolean>()
const longPressCount = shallowRef(0)
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="toggle-icon-state"
      title="状态切换"
      description="v-model 管理激活色，click 表达操作意图，change 提供最终状态。"
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <article
          class="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--nui-divider-color)] p-4"
        >
          <DcToggleIcon
            v-model="favorite"
            :icon="HeartIcon"
            size="32"
            class="cursor-pointer"
            @click="lastEvent = `click → ${$event}`"
            @change="lastEvent = `change → ${$event}`"
          >
            {{ favorite ? '已喜欢' : '喜欢' }}
          </DcToggleIcon>
          <NTag size="small" :type="favorite ? 'success' : 'default'" :bordered="false">
            {{ favorite }}
          </NTag>
        </article>

        <article
          class="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--nui-divider-color)] p-4"
        >
          <DcToggleIcon
            v-model="bookmarked"
            :icon="BookmarkIcon"
            size="32"
            class="cursor-pointer"
            @change="lastEvent = `书签 change → ${$event}`"
          >
            {{ bookmarked ? '已收藏' : '收藏' }}
          </DcToggleIcon>
          <NTag size="small" type="info" :bordered="false">初始开启</NTag>
        </article>

        <article
          class="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--nui-divider-color)] p-4"
        >
          <DcToggleIcon
            :model-value="true"
            :icon="HeartIcon"
            size="32"
            dis-changed
            class="cursor-pointer"
            @click="controlledIntent = $event"
          >
            受控状态
          </DcToggleIcon>
          <NTag size="small" type="warning" :bordered="false">
            意图：{{ controlledIntent ?? '待点击' }}
          </NTag>
        </article>
      </div>
      <template #note>{{ lastEvent }}；disChanged 只发出 click 意图，不会自行改变 model。</template>
    </DemoSection>

    <DemoSection
      section-id="toggle-icon-layout"
      title="尺寸与布局"
      description="图标可以纵向或横向排布，并通过 padding 扩展可点击区域。"
    >
      <div class="flex flex-wrap items-center gap-6 rounded-xl bg-[var(--nui-action-color)] p-5">
        <DcToggleIcon
          :icon="HeartIcon"
          size="20"
          padding
          class="cursor-pointer rounded-lg bg-[var(--nui-card-color)] py-3"
        >
          20px
        </DcToggleIcon>
        <DcToggleIcon
          :icon="BookmarkIcon"
          size="30"
          row-mode
          padding
          class="cursor-pointer gap-2 rounded-lg bg-[var(--nui-card-color)] py-3"
        >
          横向布局
        </DcToggleIcon>
        <DcToggleIcon
          :icon="HeartIcon"
          size="38"
          padding
          class="cursor-pointer rounded-lg bg-[var(--nui-card-color)] py-3"
          @long-click="longPressCount++"
        >
          长按我
        </DcToggleIcon>
        <div class="ml-auto flex items-center gap-2">
          <NTag type="success" :bordered="false">longClick {{ longPressCount }}</NTag>
          <NButton size="small" secondary @click="longPressCount = 0">重置</NButton>
        </div>
      </div>
    </DemoSection>
  </div>
</template>