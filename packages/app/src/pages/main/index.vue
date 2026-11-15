<script setup lang="ts">
import { RouterView } from 'vue-router'

import DesktopComponent from './components/Page.desktop.vue'
import MobileComponent from './components/Page.mobile.vue'

const Page = __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent
</script>

<template>
  <Page>
    <RouterView />
  </Page>
</template>