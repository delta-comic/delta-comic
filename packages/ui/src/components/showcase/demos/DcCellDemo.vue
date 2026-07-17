<script setup lang="ts">
import { NTag } from 'naive-ui'
import { shallowRef } from 'vue'

import { DcCell } from '@/index'

import DemoSection from '../DemoSection.vue'

const clickCount = shallowRef(0)
const slotClickCount = shallowRef(0)
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="cell-content"
      title="内容与尺寸"
      description="组合标题、说明和值，并比较常规尺寸与大尺寸的排布差异。"
    >
      <div class="overflow-hidden rounded-lg border border-[var(--nui-divider-color)]">
        <DcCell title="阅读模式" label="控制翻页方式与阅读方向" value="从右到左" />
        <DcCell
          title="本地缓存"
          label="较大尺寸会增加垂直留白并强化标题"
          value="1.8 GB"
          size="large"
          center
          required
          title-class="font-semibold"
          label-class="text-emerald-600! dark:text-emerald-400!"
          value-class="font-mono text-[var(--nui-primary-color)]!"
        />
        <DcCell tag="article" title="自定义根元素" value="article" :border="false" />
      </div>
      <template #note>
        title、label 和 value 可以独立设置样式；tag 用于选择更符合语义的根元素。
      </template>
    </DemoSection>

    <DemoSection
      section-id="cell-navigation"
      title="导航与状态"
      description="链接箭头支持四个方向，也可以单独控制可点击状态与边框。"
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="overflow-hidden rounded-lg border border-[var(--nui-divider-color)]">
          <DcCell title="下一章" value="向右" is-link :clickable="false" />
          <DcCell title="返回目录" value="向左" is-link arrow-direction="left" :clickable="false" />
          <DcCell title="收起详情" value="向上" is-link arrow-direction="up" :clickable="false" />
          <DcCell
            title="展开详情"
            value="向下"
            is-link
            arrow-direction="down"
            :clickable="false"
            :border="false"
          />
        </div>

        <div class="space-y-3 rounded-lg bg-[var(--nui-action-color)] p-4">
          <DcCell
            title="仅触发点击事件"
            label="演示页不会执行真实路由或外链跳转"
            value="点击"
            clickable
            is-link
            class="rounded-lg"
            @click="clickCount++"
          />
          <div class="flex items-center justify-between text-sm text-[var(--nui-text-color-2)]">
            <span>已触发 click</span>
            <NTag type="success" :bordered="false">{{ clickCount }} 次</NTag>
          </div>
        </div>
      </div>
    </DemoSection>

    <DemoSection
      section-id="cell-slots"
      title="插槽定制"
      description="标题、说明、值、两侧图标与附加内容都可以由插槽接管。"
    >
      <div class="overflow-hidden rounded-xl border border-[var(--nui-divider-color)]">
        <DcCell
          size="large"
          center
          clickable
          :border="false"
          title-class="min-w-0"
          value-class="shrink-0"
          @click="slotClickCount++"
        >
          <template #icon>
            <span
              class="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-lg text-emerald-600 dark:text-emerald-400"
            >
              Δ
            </span>
          </template>
          <template #title>
            <span class="font-semibold">Delta Comic</span>
          </template>
          <template #label>
            <span>全部内容均由具名插槽提供</span>
          </template>
          <template #value>
            <span class="font-mono text-[var(--nui-primary-color)]">v2.3</span>
          </template>
          <template #right-icon>
            <span aria-hidden="true" class="text-xl text-[var(--nui-text-color-3)]">→</span>
          </template>
          <template #extra>
            <NTag class="ml-3" size="small" type="success" :bordered="false">
              {{ slotClickCount || 'NEW' }}
            </NTag>
          </template>
        </DcCell>
      </div>
    </DemoSection>
  </div>
</template>