<script setup lang="ts">
import { createDateString } from '@/utils/date'
import { SharedFunction } from '@delta-comic/core'
import type { uni } from '@delta-comic/model'
import { DcImage } from '@delta-comic/ui'
import { MoreVertRound } from '@vicons/material'

defineProps<{ item: uni.item.Item }>()
defineEmits<{ unsubscribe: [item: uni.item.Item] }>()
</script>

<template>
  <div class="van-hairline--bottom w-full bg-(--van-background-2)" @click="
    SharedFunction.call(
      'routeToContent',
      item.contentType,
      item.id,
      item.thisEp.index,
      item
    )
    ">
    <!-- user -->
    <div class="relative flex w-full py-2">
      <div class="van-ellipsis flex w-fit items-center pl-2 text-[16px] text-(--p-color)">
        <AuthorIcon :size-spacing="10" :author="item.author[0]" />
        <div class="ml-1 flex w-full flex-col text-nowrap">
          <div class="flex items-center text-(--nui-primary-color)">
            {{ item.author[0].label }}
          </div>
          <div class="-mt-0.5 flex items-center text-[11px] text-(--van-text-color-2)">
            {{ createDateString(item.$updateTime) }}·投稿了内容
          </div>
        </div>
      </div>
      <NButton class="absolute! top-1/2 right-3 -translate-y-1/2" type="tertiary" text>
        <template #icon>
          <VanPopover placement="bottom-end" :actions="[
            {
              text: '取消关注',
              onClick() {
                $emit('unsubscribe', item)
              }
            }
          ]" @select="q => q.onClick()">
            <template #reference>
              <NIcon size="20px">
                <MoreVertRound />
              </NIcon>
            </template>
          </VanPopover>
        </template>
      </NButton>
    </div>
    <!-- cover -->
    <div class="w-full px-2">
      <DcImage :src="item.$cover" class="aspect-video w-full rounded-lg bg-black" fit="contain" />
    </div>
    <!-- title -->
    <div class="van-multi-ellipsis--l2 w-full px-2 text-base font-semibold">
      {{ item.title }}
    </div>
    <!-- action -->
    <div class="flex h-fit w-full items-center justify-around px-2 py-1">
      <NButton quaternary type="tertiary" size="large">
        <template #icon>
          <VanIcon name="share-o" />
        </template>
        转发
      </NButton>
      <NButton quaternary type="tertiary" size="large">
        <template #icon>
          <VanIcon name="share-o" />
        </template>
        转发
      </NButton>
      <NButton quaternary type="tertiary" size="large">
        <template #icon>
          <VanIcon name="share-o" />
        </template>
        转发
      </NButton>
    </div>
  </div>
</template>