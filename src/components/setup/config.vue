<script setup lang='ts'>
import { usePluginConfig } from '@/plugin'
import { NDynamicInput } from 'naive-ui'

const overrides = usePluginConfig()
</script>

<template>
  <NScrollbar class="size-full">
    <div class="mb-2 ml-4 text-lg font-semibold">下载源覆写</div>
    <NDynamicInput v-model:value="overrides" :on-create="() => ({ id: '', install: '', enabled: true })">
      <template #default="{ value }">
        <div class="flex items-center w-[calc(100%-var(--spacing)*25)]">
          <NCheckbox v-model:checked="value.enabled" class="mx-4" />
          <div class="items-center w-full ">
            <NInput v-model:value="value.id" class="w-2/3!" type="text" placeholder="插件ID" />
            <NInput v-model:value="value.install" type="text" class=" my-2" placeholder="下载语句" />
          </div>
        </div>
      </template>
    </NDynamicInput>
  </NScrollbar>
</template>