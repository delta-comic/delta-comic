<script setup lang="ts">
import { Icons } from '@delta-comic/client-app-core/icons'
import { createDateString } from '@delta-comic/client-app-core/utils/date'
import { UniItem } from '@delta-comic/client-core-model'
import type { HistoryDB, ItemStoreDB } from '@delta-comic/client-data-db'
import dayjs from 'dayjs'
import { computed } from 'vue'
const $props = defineProps<{ item: ItemStoreDB.StoredItem & HistoryDB.Item }>()

const instance = computed(() => UniItem.create($props.item.item))
</script>

<template>
  <DcVar v-if="item" :value="item?.item" v-slot="{ value }">
    <component :item="instance" :is="UniItem.itemCards.get(instance.contentType)">
      <div class="flex flex-nowrap items-center dc-ellipsis *:text-nowrap">
        <NIcon color="var(--dc-text-secondary)" size="14px">
          <Icons.antd.UserOutlined />
        </NIcon>
        <span v-for="author of value.author" class="mr-2 dc-interactive">{{ author.label }}</span>
      </div>
      <div class="flex flex-nowrap items-center dc-ellipsis *:text-nowrap">
        <NIcon color="var(--dc-text-secondary)" size="14px">
          <Icons.material.PhoneAndroidOutlined />
        </NIcon>
        <span class="mr-2 dc-interactive">{{ createDateString(dayjs(item.timestamp)) }}</span>
      </div>
    </component>
  </DcVar>
</template>