<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { UserOutlined } from '@vicons/antd'
import { computed } from 'vue'
const $props = defineProps<{ item: uni.item.RawItem; ep: uni.ep.Ep['index'] }>()

const item = computed(() => uni.item.Item.create($props.item))
</script>

<template>
  <component :is="uni.item.Item.itemCard.get(item.contentType)" :item>
    <div class="van-ellipsis flex flex-nowrap items-center *:text-nowrap">
      <NIcon color="var(--van-text-color-2)" size="14px">
        <UserOutlined />
      </NIcon>
      <span v-for="author of item.author" class="van-haptics-feedback mr-2">{{
        author.label
      }}</span>
    </div>
  </component>
</template>