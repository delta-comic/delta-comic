<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import { useDialog, useLoadingBar, useMessage, useThemeVars } from 'naive-ui'
import { useStyleTag } from '@vueuse/core'

import { AnimatePresence, motion } from 'motion-v'
import App from './App.vue'
import Plugin from './components/plugin/index.vue'
import { Global } from '@delta-comic/plugin'
import { DcImage } from '@delta-comic/ui'

window.$message = useMessage()
window.$loading = useLoadingBar()
window.$dialog = useDialog()
const cssVars = useThemeVars()
const injectStyle = computed(() => {
  let css = 'body {\n'
  for (const key in cssVars.value) {
    const styleValue = cssVars.value[key as keyof typeof cssVars.value]
    const styleKey = `--nui-${key
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
      .replace(/([0-9])([a-zA-Z])/g, '$1-$2')
      .toLowerCase()}`
    css += `${styleKey}: ${styleValue};\n`
  }
  css += '}'
  return css
})
useStyleTag(injectStyle)


const isBooted = shallowRef(false)

const showContent = shallowRef(false)
</script>

<template>
  <AnimatePresence>
    <template v-if="!isBooted">
      <div
        class="fixed top-0 left-0 flex size-full justify-center overflow-hidden bg-(--van-background-2) transition-all">
        <DcImage hide-loading src="/setup.avif" class="absolute top-1/2 w-[95%]! -translate-y-3/5" fit="scale-down" />
        <div class="absolute bottom-16 text-2xl font-semibold text-(--p-color)">Delta Comic</div>
      </div>
    </template>
    <motion.div @click="showContent = true"
      class="van-haptics-feedback fixed bottom-10 flex -translate-x-1/2 items-center justify-center overflow-hidden rounded-xl bg-(--p-color) shadow-2xl! transition-opacity"
      :initial="{ width: '40px', height: '40px', left: '50%', translateY: '150px' }" v-if="!isBooted"
      :exit="{ width: '40px', height: '40px', left: '50%', translateY: '150px' }"
      :animate="{ width: '80px', height: '80px', left: '50%', translateY: '0px' }">
      <NIcon color="white" size="40px">
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512">
          <path
            d="M345.14 480H256v-45.71a31.3 31.3 0 0 0-9.59-22.65c-7.67-7.56-18.83-11.81-30.57-11.64a44.38 44.38 0 0 0-28.45 10.67c-5.2 4.6-11.39 12.56-11.39 24.42V480H87.62A55.68 55.68 0 0 1 32 424.38V336h45.71c9.16 0 18.07-3.92 25.09-11a42.06 42.06 0 0 0 12.2-29.92C114.7 273.89 97.26 256 76.91 256H32v-89.34a53.77 53.77 0 0 1 16.53-39A55.88 55.88 0 0 1 87.62 112h63.24V97.52A65.53 65.53 0 0 1 217.54 32c35.49.62 64.36 30.38 64.36 66.33V112h63.24A54.28 54.28 0 0 1 400 166.86v63.24h13.66c36.58 0 66.34 29 66.34 64.64c0 36.61-29.39 66.4-65.52 66.4H400v63.24c0 30.67-24.61 55.62-54.86 55.62z"
            fill="currentColor"></path>
        </svg>
      </NIcon>
    </motion.div>
  </AnimatePresence>
  <Suspense v-if="isBooted">
    <App />
  </Suspense>
  <Plugin v-model:show="showContent" v-model:is-booted="isBooted" />
  <component v-for="c of Global.globalNodes" :is="c" />
</template>