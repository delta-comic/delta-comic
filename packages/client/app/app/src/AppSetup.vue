<script setup lang="ts">
import { configurePluginHost, loadEnabledPlugins } from '@delta-comic/plugin'
import { useDialog, useLoadingBar, useMessage } from 'naive-ui'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import App from './App.vue'
import UpdateChecker from './components/updateChecker.vue'
import { createPluginAuthGateway } from './features/pluginAuth/gateway'
import { appLogger } from './logger'

const { t } = useI18n()
window.$message = useMessage()
window.$loading = useLoadingBar()
window.$dialog = useDialog()
configurePluginHost({ auth: createPluginAuthGateway(() => t('common.actions.confirm')) })

onMounted(() => {
  void loadEnabledPlugins().catch(error => {
    appLogger.scoped('plugin').error('plugin loading failed', error)
    window.$message.error(t('plugin.list.safeMode'))
  })
})
</script>

<template>
  <Suspense><App /></Suspense>
  <UpdateChecker />
</template>