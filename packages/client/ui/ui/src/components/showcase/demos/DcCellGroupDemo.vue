<script setup lang="ts">
import { NTag } from 'naive-ui'

import { DcCell, DcCellGroup } from '@/index'

import DemoSection from '../DemoSection.vue'
</script>

<template>
  <div class="space-y-6">
    <DemoSection
      section-id="cell-group-basic"
      title="基础分组"
      description="用标题和组边框组织连续的信息行，并比较有无外边框的效果。"
    >
      <div class="grid gap-5 lg:grid-cols-2">
        <DcCellGroup title="阅读设置" border class="overflow-hidden rounded-lg">
          <DcCell title="翻页方向" value="从右到左" />
          <DcCell title="音量键翻页" value="已开启" />
          <DcCell title="保持屏幕常亮" value="已关闭" />
        </DcCellGroup>

        <DcCellGroup title="无组边框" :border="false" class="overflow-hidden rounded-lg">
          <DcCell title="图片质量" value="原图" />
          <DcCell title="预加载页数" value="4 页" />
          <DcCell title="缓存上限" value="2 GB" :border="false" />
        </DcCellGroup>
      </div>
      <template #note>border 控制组容器的上下发丝线，各个 DcCell 仍可单独控制行分隔线。</template>
    </DemoSection>

    <DemoSection
      section-id="cell-group-inset"
      title="嵌入与插槽"
      description="inset 会增加水平留白和圆角，标题插槽可承载状态与操作提示。"
    >
      <div class="rounded-xl bg-[var(--nui-action-color)] py-2">
        <DcCellGroup inset border data-demo="inset-group">
          <template #title>
            <div class="flex items-center justify-between gap-3">
              <span class="font-medium text-[var(--nui-text-color-1)]">同步服务</span>
              <NTag size="small" type="success" :bordered="false">运行中</NTag>
            </div>
          </template>
          <DcCell
            title="阅读进度"
            label="最后同步于 2 分钟前"
            value="自动"
            is-link
            :clickable="false"
          />
          <DcCell
            title="收藏夹"
            label="仅在 Wi-Fi 环境同步封面"
            value="12 项"
            is-link
            :clickable="false"
            :border="false"
          />
        </DcCellGroup>
      </div>
      <template #note>根节点会透传 data-*、aria-* 与 class 等属性，便于挂载业务标记。</template>
    </DemoSection>
  </div>
</template>