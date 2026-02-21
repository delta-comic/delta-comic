<script setup lang="ts"></script>

<template>
  <NResult status="418" title="建设中" description="商店功能锐意开发中">
    <template #footer>
      <NButton @click="$router.force.replace({ name: '/main/plugin' })">
        接受事实就是这么简单
      </NButton>
    </template>
  </NResult>
</template>