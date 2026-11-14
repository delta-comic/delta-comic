import { useConfig } from '@delta-comic/plugin'
import {
  configureUiI18n,
  createDownloadMessage,
  DcConfigProvider,
  type UiMessageKey,
  type UiMessageParams,
} from '@delta-comic/ui'
import { PiniaColada } from '@pinia/colada'
import { isTauri } from '@tauri-apps/api/core'
import { listen, TauriEvent } from '@tauri-apps/api/event'
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
import { createApp, defineComponent, h, vaporInteropPlugin, watch } from 'vue'
import { DataLoaderPlugin } from 'vue-router/experimental'

import '@/index.css'
import { prepareAppPluginHost, disposeAppPluginHost } from '@/clientHost'
import { i18n } from '@/i18n/index'
import { configureCoreHost } from '@/index'

import AppSetup from './AppSetup'
import { appLogger } from './logger'
import { initializePlatform, openExternal, resolveAppHostProfile } from './platform'
import { router } from './router'
configureUiI18n((key: UiMessageKey, params?: UiMessageParams) =>
  i18n.global.t(`ui.${key}`, params as Record<string, number | string>),
)
document.addEventListener('contextmenu', e => e.preventDefault())
document.documentElement.lang = 'zh-CN'
configureCoreHost({
  navigation: router,
  platform: {
    openExternal,
    isNative: isTauri,
    listenResume: callback => listen(TauriEvent.WINDOW_RESUMED, callback),
  },
  ui: { warning: message => window.$message.warning(message), createDownloadMessage },
})
const appHostProfile = await resolveAppHostProfile()
appLogger.scoped('platform').info('app host profile resolved', appHostProfile)
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
await prepareAppPluginHost()
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
    return () =>
      h(
        NConfigProvider,
        {
          locale: naiveLocale.locale,
          dateLocale: naiveLocale.dateLocale,
          abstract: true,
          theme: config.isDark ? darkTheme : lightTheme,
          themeOverrides: themeOverrides,
        },
        h(DcConfigProvider, { locale: 'zh-CN', theme: config.isDark ? 'dark' : 'light' }, [
          h(NGlobalStyle, undefined),
          h(
            NLoadingBarProvider,
            undefined,
            h(
              NDialogProvider,
              undefined,
              h(
                'div',
                { class: 'h-full overflow-hidden' },
                h(NMessageProvider, { max: 5 }, h(AppSetup, undefined)),
              ),
            ),
          ),
        ]),
      )
  }),
)
app.use(vaporInteropPlugin)
app.use(DataLoaderPlugin, { router })
app.use(pinia)
app.use(PiniaColada)
app.use(i18n)
app.use(router)
const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)
app.mount('#app')
appLogger.info('frontend application mounted')
window.addEventListener('beforeunload', () => void disposeAppPluginHost())