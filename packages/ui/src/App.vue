<script setup lang="ts">
import { useDialog, useLoadingBar, useMessage } from 'naive-ui'

window.$message = useMessage()
window.$loading = useLoadingBar()
window.$dialog = useDialog()
</script>

<template>
  <RouterView />
</template>