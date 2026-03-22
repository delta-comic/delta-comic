declare module 'vue-router' {
  interface Router {
    force: { push: Router['push']; replace: Router['replace'] }
  }
  interface RouteMeta {
    statusBar?: Vue.MaybeRefOrGetter<'dark' | 'light' | 'auto'>
    force?: boolean
  }
}

import 'core-js'
import * as DcCore from '@delta-comic/core'
import * as DcDb from '@delta-comic/db'
import * as DcModel from '@delta-comic/model'
import * as DcPlugin from '@delta-comic/plugin'

import './logger'
DcCore
DcDb
DcModel
DcPlugin
import * as DcRequire from '@delta-comic/request'
import * as DcUi from '@delta-comic/ui'
import * as DcUtils from '@delta-comic/utils'
import * as Pc from '@pinia/colada'
import { reactiveComputed, useCssVar, useDark } from '@vueuse/core'
import * as Axios from 'axios'
import axios from 'axios'
import Color from 'color'
import * as Naive from 'naive-ui'
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NLoadingBarProvider,
  zhCN,
  type GlobalThemeOverrides,
  darkTheme,
  NGlobalStyle
} from 'naive-ui'
import * as Pinia from 'pinia'
import { createPinia } from 'pinia'

import '@/index.css'
import 'vant/lib/index.css'
import { CORSFetch } from 'tauri-plugin-better-cors-fetch'
import { M3, type InsetsScheme } from 'tauri-plugin-m3'
import * as Vant from 'vant'
import { ConfigProvider as VanConfigProvider, type ConfigProviderThemeVars } from 'vant'
import * as Vue from 'vue'
import { createApp, defineComponent, watch } from 'vue'
import * as VR from 'vue-router'
import { DataLoaderPlugin } from 'vue-router/experimental'

import AppSetup from './AppSetup.vue'
import { router } from './router'
CORSFetch.init({ request: { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } } })

axios.defaults.timeout = 7000
axios.defaults.adapter = ['fetch']
window.$$lib$$ = {
  Axios: { ...Axios, ...axios, axios },
  Vue,
  Vant,
  Naive,
  VR,
  Pinia,
  DcModel,
  DcUi,
  DcCore,
  DcPlugin,
  DcUtils,
  DcRequire,
  DcDb,
  Pc
}
window.$api.NImage = Naive.NImage
window.$api.showImagePreview = Vant.showImagePreview
window.$api.M3 = M3

document.addEventListener('contextmenu', e => e.preventDefault())

const handleSafeAreaChange = (v: InsetsScheme | false) => {
  if (!v)
    v = { adjustedInsetBottom: 0, adjustedInsetLeft: 0, adjustedInsetRight: 0, adjustedInsetTop: 0 }
  const { adjustedInsetBottom, adjustedInsetLeft, adjustedInsetRight, adjustedInsetTop } = v
  document.documentElement.style.setProperty(
    `--safe-area-inset-bottom`,
    `${adjustedInsetBottom ?? 0}px`
  )
  document.documentElement.style.setProperty(
    `--safe-area-inset-left`,
    `${adjustedInsetLeft ?? 0}px`
  )
  document.documentElement.style.setProperty(
    `--safe-area-inset-right`,
    `${adjustedInsetRight ?? 0}px`
  )
  document.documentElement.style.setProperty(`--safe-area-inset-top`, `${adjustedInsetTop ?? 0}px`)
}
await M3.getInsets().then(handleSafeAreaChange)

const app = createApp(
  defineComponent(() => {
    const themeColor = Color('#fb7299').hex()
    const themeColorDark = Color(themeColor).darken(0.2).hex()
    const config = DcPlugin.useConfig()

    const themeOverrides = reactiveComputed<GlobalThemeOverrides>(() => ({
      common: {
        primaryColor: themeColor,
        primaryColorHover: Color(themeColor).lighten(0.2).hex(),
        primaryColorPressed: themeColorDark,
        primaryColorSuppl: themeColorDark,
        cardColor: config.isDark ? '#17181a' : undefined
      }
    }))
    const fontBold = useCssVar('--nui-font-weight')

    const isUseDarkMode = useDark({ listenToStorageChanges: false })
    watch(
      () => config.isDark,
      isDark => (isUseDarkMode.value = isDark)
    )
    return () => (
      <NConfigProvider
        locale={zhCN}
        abstract
        theme={config.isDark ? darkTheme : undefined}
        themeOverrides={themeOverrides}
      >
        <NGlobalStyle />
        <NLoadingBarProvider container-class='z-200000'>
          <NDialogProvider to='#popups'>
            <VanConfigProvider
              themeVars={
                {
                  blue: themeColor,
                  green: themeOverrides.common?.successColor,
                  red: themeOverrides.common?.errorColor,
                  orange: themeOverrides.common?.warningColor,

                  baseFont: 'var(--nui-font-family)',
                  priceFont: 'var(--font-family-mono)',

                  background: config.isDark ? themeOverrides.common?.cardColor : undefined,

                  fontBold: fontBold.value
                } as ConfigProviderThemeVars
              }
              class='h-full overflow-hidden'
              theme={config.isDark ? 'dark' : 'light'}
              themeVarsScope='global'
            >
              <NMessageProvider max={5} to='#messages'>
                <AppSetup />
              </NMessageProvider>
            </VanConfigProvider>
          </NDialogProvider>
        </NLoadingBarProvider>
      </NConfigProvider>
    )
  })
)
DcCore.initSentry(app)

app.use(DataLoaderPlugin, { router })

const pinia = createPinia()
app.use(pinia)

app.use(Pc.PiniaColada)

app.use(router)

const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

app.mount('#app')