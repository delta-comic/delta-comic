<script setup lang="ts">
import { UserOutlined } from '@vicons/antd'
import { coreModule, requireDepend, uni } from 'delta-comic-core'
defineProps<{ item: uni.item.RawItem; ep: uni.ep.Ep['index'] }>()

const {
  comp: { ItemCard }
} = requireDepend(coreModule)
</script>

<template>
  <ItemCard :item="uni.item.Item.create(item)">
    <div class="van-ellipsis flex flex-nowrap items-center *:text-nowrap">
      <NIcon color="var(--van-text-color-2)" size="14px">
        <UserOutlined />
      </NIcon>
      <span v-for="author of item.author" class="van-haptics-feedback mr-2">{{
        author.label
      }}</span>
    </div>
  </ItemCard>
</template>