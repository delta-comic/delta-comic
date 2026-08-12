import { pluginRuntime, useConfig } from '@delta-comic/plugin'
import {
  configureUiI18n,
  DcConfigProvider,
  type UiMessageKey,
  type UiMessageParams,
} from '@delta-comic/ui'
import { PiniaColada } from '@pinia/colada'
import { reactiveComputed, useDark } from '@vueuse/core'
import Color from 'color'
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NLoadingBarProvider,
  dateZhCN,
  zhCN as naiveZhCN,
  type GlobalThemeOverrides,
  darkTheme,
  lightTheme,
  NGlobalStyle,
} from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, watch } from 'vue'

import '@/index.css'
import { DataLoaderPlugin } from 'vue-router/experimental'

import AppSetup from './AppSetup.vue'
import { i18n } from './i18n'
import { appLogger } from './logger'
import { initializePlatform } from './platform'
import { router } from './router'

configureUiI18n((key: UiMessageKey, params?: UiMessageParams) =>
  i18n.global.t(`ui.${key}`, params as Record<string, number | string>),
)

document.addEventListener('contextmenu', e => e.preventDefault())
document.documentElement.lang = 'zh-CN'

await initializePlatform().then(v => {
  appLogger.scoped('platform').info('platform initialized', { nativeInsets: v || undefined })
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
    const config = useConfig()
    const naiveLocale = { dateLocale: dateZhCN, locale: naiveZhCN }

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
        locale={naiveLocale.locale}
        dateLocale={naiveLocale.dateLocale}
        abstract
        theme={config.isDark ? darkTheme : lightTheme}
        themeOverrides={themeOverrides}
      >
        <DcConfigProvider locale='zh-CN' theme={config.isDark ? 'dark' : 'light'}>
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
        </DcConfigProvider>
      </NConfigProvider>
    )
  }),
)

app.use(DataLoaderPlugin, { router })

app.use(pinia)

app.use(PiniaColada)

app.use(i18n)

app.use(router)

const preboot = await pluginRuntime.preparePreboot(app)
appLogger
  .scoped('plugin')
  .info('plugin preboot prepared', {
    activated: preboot.activated,
    failureCount: preboot.failures.length,
  })

const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

app.mount('#app')
appLogger.info('frontend application mounted')