<script setup lang='ts'>
import { useNativeStore } from '@/db'
import { pluginName } from '@/symbol'

const overrides = useNativeStore(pluginName, 'pluginInstallSourceOverrides', new Array<SourceOverrideConfig>())
</script>

<template>
  <NScrollbar class="size-full">
    <div>下载源覆写</div>
    <TransitionGroup tag="ul" name="list">
      <NDynamicInput v-model:value="overrides" preset="pair" key-placeholder="环境变量名" value-placeholder="环境变量值" />
    </TransitionGroup>
  </NScrollbar>
</template>