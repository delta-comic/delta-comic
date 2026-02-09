import 'core-js'

import { attachConsole } from '@tauri-apps/plugin-log'
await attachConsole()
import * as Vue from 'vue'
window.$$lib$$.Vue = Vue
import * as Vant from 'vant'
window.$$lib$$.Vant = Vant
import * as Naive from 'naive-ui'
window.$$lib$$.Naive = Naive

import { CORSFetch } from 'tauri-plugin-better-cors-fetch'
CORSFetch.init({ request: { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } } })

import * as Axios from 'axios'
import axios from 'axios'

axios.defaults.timeout = 7000
axios.defaults.adapter = ['fetch']

window.$$lib$$.Axios = { ...Axios, ...axios, axios }

import * as Dcc from 'delta-comic-core'
window.$$lib$$.Dcc = Dcc
import * as Vr from 'vue-router'
window.$$lib$$.VR = Vr
import * as Pinia from 'pinia'
window.$$lib$$.Pinia = Pinia
window.$api.NImage = Naive.NImage
window.$api.showImagePreview = Vant.showImagePreview

import '@/index.css'
import 'vant/lib/index.css'
import '@/db'

import * as Sentry from '@sentry/vue'
import { createPlugin } from '@tauri-store/pinia'
import { reactiveComputed, useCssVar, useDark } from '@vueuse/core'
import Color from 'color'
import { Store } from 'delta-comic-core'
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
import { createPinia } from 'pinia'
import { M3, type InsetsScheme } from 'tauri-plugin-m3'
import { defaultOptions } from 'tauri-plugin-sentry-api'
import { ConfigProvider as VanConfigProvider, type ConfigProviderThemeVars } from 'vant'
import { createApp, defineComponent, watch } from 'vue'

import AppSetup from './AppSetup.vue'
import { router } from './router'
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
    const themeOverrides = reactiveComputed<GlobalThemeOverrides>(() => ({
      common: {
        primaryColor: themeColor,
        primaryColorHover: Color(themeColor).lighten(0.2).hex(),
        primaryColorPressed: themeColorDark,
        primaryColorSuppl: themeColorDark
      }
    }))
    const config = Store.useConfig()
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
Sentry.init({ ...defaultOptions, app, sendDefaultPii: true })

const pinia = createPinia()
pinia.use(createPlugin())
app.use(pinia)

app.use(router)

const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

app.mount('#app')