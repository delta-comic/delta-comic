import 'core-js'
import * as DcDb from '@delta-comic/db'
import * as DcModel from '@delta-comic/model'
import * as DcPlugin from '@delta-comic/plugin'
import * as DcUi from '@delta-comic/ui'

import './logger'
import * as DcUtils from '@delta-comic/utils'
import * as Pc from '@pinia/colada'
import { reactiveComputed, useDark } from '@vueuse/core'
import Color from 'color'
import * as Naive from 'naive-ui'
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NLoadingBarProvider,
  dateEnUS,
  dateZhCN,
  dateZhTW,
  enUS as naiveEnUS,
  zhCN as naiveZhCN,
  zhTW as naiveZhTW,
  type GlobalThemeOverrides,
  darkTheme,
  lightTheme,
  NGlobalStyle,
} from 'naive-ui'
import * as Pinia from 'pinia'
import { createPinia, setActivePinia } from 'pinia'

import '@/index.css'
import * as Vue from 'vue'
import { computed, createApp, defineComponent, watch } from 'vue'
import * as VR from 'vue-router'
import { DataLoaderPlugin } from 'vue-router/experimental'

import AppSetup from './AppSetup.vue'
import { i18n, resolveAppLocale } from './i18n'
import { initializePlatform } from './platform'
import { router } from './router'

window.$$lib$$ = { Vue, Naive, VR, Pinia, DcModel, DcUi, DcPlugin, DcUtils, DcDb, Pc }
DcUi.configureUiI18n((key: DcUi.UiMessageKey, params?: DcUi.UiMessageParams) =>
  i18n.global.t(`ui.${key}`, params as Record<string, number | string>),
)

document.addEventListener('contextmenu', e => e.preventDefault())

await initializePlatform().then(v => {
  for (const direction of ['Top', 'Bottom', 'Left', 'Right'] as const)
    document.documentElement.style.setProperty(
      `--safe-area-inset-${direction.toLowerCase()}`,
      `${(v || {})[`adjustedInset${direction}`] ?? 0}px`,
    )
})

const pinia = createPinia()
setActivePinia(pinia)

const app = createApp(
  defineComponent(() => {
    const themeColor = Color('#fb7299').hex()
    const themeColorDark = Color(themeColor).darken(0.2).hex()
    const config = DcPlugin.useConfig()
    const locale = computed(() => resolveAppLocale(config.$loadApp().data.value.language))
    const naiveLocale = computed(() => {
      switch (locale.value) {
        case 'zh-CN':
          return { dateLocale: dateZhCN, locale: naiveZhCN }
        case 'zh-TW':
          return { dateLocale: dateZhTW, locale: naiveZhTW }
        default:
          return { dateLocale: dateEnUS, locale: naiveEnUS }
      }
    })

    watch(
      locale,
      value => {
        i18n.global.locale.value = value
        document.documentElement.lang = value
      },
      { immediate: true },
    )

    const themeOverrides = reactiveComputed<GlobalThemeOverrides>(() => ({
      common: {
        primaryColor: themeColor,
        primaryColorHover: Color(themeColor).lighten(0.2).hex(),
        primaryColorPressed: themeColorDark,
        primaryColorSuppl: themeColorDark,
        cardColor: config.isDark ? '#17181a' : undefined,
      },
    }))
    const isUseDarkMode = useDark({ listenToStorageChanges: false })
    watch(
      () => config.isDark,
      isDark => {
        isUseDarkMode.value = isDark
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
      },
      { immediate: true },
    )
    return () => (
      <NConfigProvider
        locale={naiveLocale.value.locale}
        dateLocale={naiveLocale.value.dateLocale}
        abstract
        theme={config.isDark ? darkTheme : lightTheme}
        themeOverrides={themeOverrides}
      >
        <NGlobalStyle />
        <NLoadingBarProvider>
          <NDialogProvider>
            <div class='h-full overflow-hidden'>
              <NMessageProvider max={5}>
                <AppSetup />
              </NMessageProvider>
            </div>
          </NDialogProvider>
        </NLoadingBarProvider>
      </NConfigProvider>
    )
  }),
)

app.use(DataLoaderPlugin, { router })

app.use(pinia)

app.use(Pc.PiniaColada)

app.use(i18n)

app.use(router)

const preboot = await DcPlugin.pluginRuntime.preparePreboot(app)
if (preboot.reloadRequired) {
  location.reload()
  await new Promise<never>(() => {})
}

const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

app.mount('#app')