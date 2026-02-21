<script setup lang="ts">
import { createDateString } from '@/utils/date'
import type { ItemStoreDB, RecentDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { UserOutlined } from '@vicons/antd'
import { TimerRound } from '@vicons/material'
import dayjs from 'dayjs'
import { computed } from 'vue'
const $props = defineProps<{ item: ItemStoreDB.StoredItem & RecentDB.Item }>()

const instance = computed(() => uni.item.Item.create($props.item.item))
</script>

<template>
  <DcVar v-if="item" :value="item?.item" v-slot="{ value }">
    <component :item="instance" :is="uni.item.Item.itemCard.get(instance.contentType)">
      <div class="van-ellipsis flex flex-nowrap items-center *:text-nowrap">
        <NIcon color="var(--van-text-color-2)" size="14px">
          <UserOutlined />
        </NIcon>
        <span v-for="author of value.author" class="van-haptics-feedback mr-2">{{
          author.label
          }}</span>
      </div>
      <div class="van-ellipsis flex flex-nowrap items-center *:text-nowrap">
        <NIcon color="var(--van-text-color-2)" size="14px">
          <TimerRound />
        </NIcon>
        <span class="van-haptics-feedback mr-2">{{
          createDateString(dayjs(item.timestamp))
          }}</span>
      </div>
    </component>
  </DcVar>
</template>