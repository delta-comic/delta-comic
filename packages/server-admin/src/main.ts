import './index.css'
import { installGlobalLogger, logger } from '@delta-comic/logger'
import { usePreferredDark } from '@vueuse/core'
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  zhCN,
  darkTheme,
  lightTheme,
} from 'naive-ui'
import { createPinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'

import App from './App.vue'
import { router } from './router'

const adminLogger = logger.scoped('server-admin:lifecycle')

installGlobalLogger(logger)
adminLogger.info('server admin bootstrap started')

const app = createApp(
  defineComponent(() => {
    const isDark = usePreferredDark()
    return () =>
      h(
        NConfigProvider,
        { locale: zhCN, theme: isDark.value ? darkTheme : lightTheme },
        {
          default: () => [
            h(NGlobalStyle),
            h(NDialogProvider, null, {
              default: () => h(NMessageProvider, null, { default: () => h(App) }),
            }),
          ],
        },
      )
  }),
)

app.config.errorHandler = (error, _instance, info) => {
  adminLogger.error('uncaught Vue error', { error, info })
}
router.onError(error => {
  adminLogger.error('router navigation failed', { error })
})
router.afterEach(to => {
  adminLogger.debug('router navigation completed', { route: to.name ?? to.path })
})
app.use(createPinia())
app.use(router)
app.mount('#app')
adminLogger.info('server admin mounted')