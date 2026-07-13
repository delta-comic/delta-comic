<script setup lang="ts">
import type { uni } from '@delta-comic/model'
import { SharedFunction } from '@delta-comic/utils'
import { NButton, NDropdown, NIcon, type DropdownOption } from 'naive-ui'
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'
import { createDateString } from '@/utils/date'

defineProps<{ item: uni.item.Item }>()
const emit = defineEmits<{ unsubscribe: [item: uni.item.Item] }>()
const { t } = useI18n()

const menuOptions = computed<DropdownOption[]>(() => [
  { label: t('subscription.actions.unsubscribe'), key: 'unsubscribe' },
])
const shareActions = ['forward', 'comment', 'share'] as const

const ShareIcon = () =>
  h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' }, [
    h('path', {
      d: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11A2.99 2.99 0 1 0 15 5c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 8.04 14.19l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z',
      fill: 'currentColor',
    }),
  ])

const handleMenuSelect = (key: string | number, item: uni.item.Item) => {
  if (key === 'unsubscribe') emit('unsubscribe', item)
}
</script>

<template>
  <div
    class="dc-hairline--bottom w-full bg-(--dc-background-2)"
    @click="SharedFunction.call('routeToContent', item.contentType, item.id, item.thisEp.id, item)"
  >
    <!-- user -->
    <div class="relative flex w-full py-2">
      <div class="dc-ellipsis flex w-fit items-center pl-2 text-[16px] text-(--p-color)">
        <DcAuthorIcon :size-spacing="10" :author="item.author[0]" />
        <div class="ml-1 flex w-full flex-col text-nowrap">
          <div class="flex items-center text-(--nui-primary-color)">
            {{ item.author[0].label }}
          </div>
          <div class="-mt-0.5 flex items-center text-[11px] text-(--dc-text-color-2)">
            {{ t('subscription.publishedAt', { date: createDateString(item.updateTime) }) }}
          </div>
        </div>
      </div>
      <NDropdown
        trigger="click"
        placement="bottom-end"
        :options="menuOptions"
        @select="key => handleMenuSelect(key, item)"
      >
        <NButton
          class="absolute! top-1/2 right-3 -translate-y-1/2"
          type="tertiary"
          text
          circle
          :aria-label="t('subscription.actions.menu')"
          @click.stop
        >
          <template #icon>
            <NIcon size="20px"><Icons.material.MoreVertRound /></NIcon>
          </template>
        </NButton>
      </NDropdown>
    </div>
    <!-- cover -->
    <div class="w-full px-2">
      <DcImage :src="item.$cover" class="aspect-video w-full rounded-lg bg-black" fit="contain" />
    </div>
    <!-- title -->
    <div class="dc-multi-ellipsis--l2 w-full px-2 text-base font-semibold">
      {{ item.title }}
    </div>
    <!-- action -->
    <div class="flex h-fit w-full items-center justify-around px-2 py-1">
      <NButton
        v-for="action of shareActions"
        :key="action"
        quaternary
        type="tertiary"
        size="large"
        @click.stop
      >
        <template #icon>
          <NIcon><ShareIcon /></NIcon>
        </template>
        {{ t('subscription.actions.forward') }}
      </NButton>
    </div>
  </div>
</template>