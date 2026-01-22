<script setup lang='ts'>
import { usePluginConfig } from '@/plugin'
import { NDynamicInput } from 'naive-ui'

const overrides = usePluginConfig()
</script>

<template>
  <NScrollbar class="size-full">
    <div>下载源覆写</div>
    <TransitionGroup tag="ul" name="list">
      <NDynamicInput v-model:value="overrides">
        <template #default="{ value }">
          <div class="flex items-center w-full">
            <NInput v-model:value="value.id" class="w-1/3!" type="text" />
            <NInput v-model:value="value.install" type="text" />
          </div>
        </template>
      </NDynamicInput>
    </TransitionGroup>
  </NScrollbar>
</template>