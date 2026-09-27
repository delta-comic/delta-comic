<script setup lang="ts">
import { type UniEp, UniItem, type UniItemRaw } from '@delta-comic/model'
import { computed } from 'vue'

import { Icons } from '@/icons'
const $props = defineProps<{ item: UniItemRaw; ep: UniEp['id'] }>()

const item = computed(() => UniItem.create($props.item))
</script>

<template>
  <component :is="UniItem.itemCards.get(item.contentType)" :item>
    <div class="flex flex-nowrap items-center dc-ellipsis *:text-nowrap">
      <NIcon color="var(--dc-text-secondary)" size="14px">
        <Icons.antd.UserOutlined />
      </NIcon>
      <span v-for="author of item.author" class="mr-2 dc-interactive">{{ author.label }}</span>
    </div>
  </component>
</template>