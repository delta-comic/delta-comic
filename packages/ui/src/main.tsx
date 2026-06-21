import { PiniaColada } from '@pinia/colada'

import './index.css'
import { useDark, usePreferredDark } from '@vueuse/core'
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NLoadingBarProvider,
  zhCN,
  darkTheme,
  NGlobalStyle,
} from 'naive-ui'
import { createPinia } from 'pinia'
import { createApp, defineComponent, watch } from 'vue'
import { DataLoaderPlugin } from 'vue-router/experimental'

import App from './App.vue'
import { router } from './router'

document.addEventListener('contextmenu', e => e.preventDefault())

const app = createApp(
  defineComponent(() => {
    const isDark = usePreferredDark()

    const themeColor = '#fb7299'
    const themeColorDark = `color-mix(in oklch, ${themeColor}, black 20%)`

    const isUseDarkMode = useDark({ listenToStorageChanges: false })
    watch(
      () => isDark.value,
      isDark => (isUseDarkMode.value = isDark),
    )
    return () => (
      <NConfigProvider
        locale={zhCN}
        abstract
        theme={isDark.value ? darkTheme : undefined}
        themeOverrides={{
          common: {
            primaryColor: themeColor,
            primaryColorHover: `color-mix(in oklch, ${themeColor}, white 20%)`,
            primaryColorPressed: themeColorDark,
            primaryColorSuppl: themeColorDark,
            cardColor: isDark.value ? '#17181a' : undefined,
          },
        }}
      >
        <NGlobalStyle />
        <NLoadingBarProvider>
          <NDialogProvider>
            <NMessageProvider max={5}>
              <App />
            </NMessageProvider>
          </NDialogProvider>
        </NLoadingBarProvider>
      </NConfigProvider>
    )
  }),
)

app.use(DataLoaderPlugin, { router })

const pinia = createPinia()
app.use(pinia)

app.use(PiniaColada)

app.use(router)

const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

app.mount('#app')