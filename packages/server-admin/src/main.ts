import './index.css'
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

app.use(createPinia())
app.use(router)
app.mount('#app')