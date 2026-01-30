import "./override"
import "./lib"
import { createApp, defineComponent, watch, } from "vue"
import { createPinia } from "pinia"
import { router } from "./router"
import "@/index.css"
import { ConfigProvider as VanConfigProvider, type ConfigProviderThemeVars } from 'vant'
import { NConfigProvider, NMessageProvider, NDialogProvider, NLoadingBarProvider, zhCN, type GlobalThemeOverrides, darkTheme, NGlobalStyle } from 'naive-ui'
import Color from "color"
import { reactiveComputed, useCssVar, useDark } from "@vueuse/core"
import AppSetup from "./AppSetup.vue"
import { Store } from "delta-comic-core"
import 'vant/lib/index.css'
import { createPlugin } from '@tauri-store/pinia'
import '@/db'
import { M3, type InsetsScheme } from "tauri-plugin-m3"
import * as Sentry from "@sentry/vue"
import { defaultOptions } from "tauri-plugin-sentry-api"
window.$api.M3 = M3

document.addEventListener('contextmenu', e => e.preventDefault())

const handleSafeAreaChange = (v: InsetsScheme | false) => {
  if (!v) return
  const { adjustedInsetBottom, adjustedInsetLeft, adjustedInsetRight, adjustedInsetTop } = v
  document.documentElement.style.setProperty(
    `--safe-area-inset-bottom`,
    `${adjustedInsetBottom}px`,
  )
  document.documentElement.style.setProperty(
    `--safe-area-inset-left`,
    `${adjustedInsetLeft}px`,
  )
  document.documentElement.style.setProperty(
    `--safe-area-inset-right`,
    `${adjustedInsetRight}px`,
  )
  document.documentElement.style.setProperty(
    `--safe-area-inset-top`,
    `${adjustedInsetTop}px`,
  )
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

    const isUseDarkMode = useDark({
      listenToStorageChanges: false
    })
    watch(() => config.isDark, isDark => isUseDarkMode.value = isDark)
    return () => (
      <NConfigProvider locale={zhCN} abstract theme={config.isDark ? darkTheme : undefined} themeOverrides={themeOverrides}>
        <NGlobalStyle />
        <NLoadingBarProvider container-class="z-200000">
          <NDialogProvider to="#popups">
            <VanConfigProvider themeVars={{

              blue: themeColor,
              green: themeOverrides.common?.successColor,
              red: themeOverrides.common?.errorColor,
              orange: themeOverrides.common?.warningColor,

              baseFont: 'var(--nui-font-family)',
              priceFont: 'var(--font-family-mono)',

              fontBold: fontBold.value
            } as ConfigProviderThemeVars} class="h-full overflow-hidden" theme={config.isDark ? 'dark' : "light"} themeVarsScope="global" >
              <NMessageProvider max={5} to="#messages">
                <AppSetup />
              </NMessageProvider>
            </VanConfigProvider>
          </NDialogProvider>
        </NLoadingBarProvider>
      </NConfigProvider>
    )
  })
)

if (!import.meta.env.DEV) Sentry.init({
  ...defaultOptions,
  app,
  sendDefaultPii: true
})

const pinia = createPinia()
pinia.use(createPlugin())
app.use(pinia)

app.use(router)

const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

app.mount("#app")
