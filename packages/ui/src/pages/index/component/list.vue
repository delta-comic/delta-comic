<script setup lang="ts">
import { useInfiniteQuery } from '@pinia/colada'
import { delay } from 'es-toolkit'
import { NCard } from 'naive-ui'

import { DcList, DcWaterfall } from '@/index'

const source = useInfiniteQuery({
  key: ['list'],
  initialPageParam: null,
  getNextPageParam: () => null,
  async query() {
    await delay(20000)

    return Array.from<object>({ length: 20 }).fill({ a: 1 })
  },
})
</script>

<template>
  <NCard title="列表" class="m-5 h-120! w-2/3!">
    <DcList
      :source="{ type: 'infinite', value: source }"
      :minHeight="120"
      v-slot="{ minHeight, index }"
      class="h-100 w-full"
    >
      <div class="w-full even:bg-amber-50/20" :style="{ minHeight: `${minHeight}px` }">
        {{ index }}
      </div>
    </DcList>
  </NCard>
  <NCard title="瀑布流" class="m-5 h-120! w-2/3!">
    <DcWaterfall
      :source="{ type: 'infinite', value: source }"
      :minHeight="120"
      v-slot="{ minHeight, index }"
      class="h-100 w-full"
    >
      <div class="w-full even:bg-amber-50/20" :style="{ minHeight: `${minHeight}px` }">
        {{ index }}
      </div>
    </DcWaterfall>
  </NCard>
</template>