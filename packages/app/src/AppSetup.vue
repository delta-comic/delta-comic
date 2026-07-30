<script setup lang="ts">
import { Global, pluginRuntime } from '@delta-comic/plugin'
import { AnimatePresence, motion } from 'motion-v'
import { useDialog, useLoadingBar, useMessage } from 'naive-ui'
import { nextTick, onMounted, shallowRef } from 'vue'

import App from './App.vue'
import Plugin from './components/plugin/index.vue'
import PrebootRecoveryAlert from './components/plugin/PrebootRecoveryAlert.vue'
import UpdateChecker from './components/updateChecker.vue'
import { appLogger } from './logger'
import { revealMainEntry } from './startup/entry'

const startupLogger = appLogger.scoped('startup')

window.$message = useMessage()
window.$loading = useLoadingBar()
window.$dialog = useDialog()

const isBooted = shallowRef(false)
const showContent = shallowRef(false)
const startupReady = shallowRef(false)
const prebootRecovery = shallowRef(pluginRuntime.readRecovery())

const dismissPrebootRecovery = () => {
  pluginRuntime.clearRecovery()
  prebootRecovery.value = null
}

onMounted(async () => {
  try {
    startupLogger.info('plugin activation started')
    const result = await pluginRuntime.activatePreboot()
    if (result.reloadRequired) {
      startupLogger.warn('plugin activation requested application reload')
      location.reload()
      return
    }
    startupReady.value = true
    await nextTick()
    await revealMainEntry()
    startupLogger.info('main entry revealed')
  } catch (error) {
    startupLogger.error('application startup failed', error)
    throw error
  }
})
</script>

<template>
  <AnimatePresence>
    <motion.img
      v-if="!isBooted"
      src="/setup.avif"
      alt=""
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 size-full object-contain"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1 }"
      :exit="{ opacity: 0 }"
    />
    <motion.div
      @click="showContent = true"
      class="fixed bottom-10 z-1 flex -translate-x-1/2 dc-interactive items-center justify-center overflow-hidden rounded-xl bg-dc-primary shadow-2xl! transition-opacity"
      :initial="{ width: '40px', height: '40px', left: '50%', translateY: '150px' }"
      v-if="!isBooted"
      :exit="{ width: '40px', height: '40px', left: '50%', translateY: '150px' }"
      :animate="{ width: '80px', height: '80px', left: '50%', translateY: '0px' }"
    >
      <NIcon color="white" size="40px">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          viewBox="0 0 512 512"
        >
          <path
            d="M345.14 480H256v-45.71a31.3 31.3 0 0 0-9.59-22.65c-7.67-7.56-18.83-11.81-30.57-11.64a44.38 44.38 0 0 0-28.45 10.67c-5.2 4.6-11.39 12.56-11.39 24.42V480H87.62A55.68 55.68 0 0 1 32 424.38V336h45.71c9.16 0 18.07-3.92 25.09-11a42.06 42.06 0 0 0 12.2-29.92C114.7 273.89 97.26 256 76.91 256H32v-89.34a53.77 53.77 0 0 1 16.53-39A55.88 55.88 0 0 1 87.62 112h63.24V97.52A65.53 65.53 0 0 1 217.54 32c35.49.62 64.36 30.38 64.36 66.33V112h63.24A54.28 54.28 0 0 1 400 166.86v63.24h13.66c36.58 0 66.34 29 66.34 64.64c0 36.61-29.39 66.4-65.52 66.4H400v63.24c0 30.67-24.61 55.62-54.86 55.62z"
            fill="currentColor"
          ></path>
        </svg>
      </NIcon>
    </motion.div>
  </AnimatePresence>
  <Suspense v-if="isBooted">
    <App />
  </Suspense>
  <Plugin v-model:show="showContent" v-model:is-booted="isBooted" :startup-ready="startupReady" />
  <PrebootRecoveryAlert
    v-if="prebootRecovery"
    :recovery="prebootRecovery"
    @dismiss="dismissPrebootRecovery"
    @manage="showContent = true"
  />
  <component v-for="c of Global.globalNodes" :is="c" />
  <UpdateChecker />
</template>