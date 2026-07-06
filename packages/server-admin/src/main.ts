import './index.css'

import { NConfigProvider, NDialogProvider, NGlobalStyle, NMessageProvider, zhCN } from 'naive-ui'
import { createPinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'

import App from './App.vue'
import { router } from './router'

const app = createApp(
  defineComponent(() => () =>
    h(
      NConfigProvider,
      { locale: zhCN },
      {
        default: () => [
          h(NGlobalStyle),
          h(NDialogProvider, null, {
            default: () => h(NMessageProvider, null, { default: () => h(App) }),
          }),
        ],
      },
    ),
  ),
)

app.use(createPinia())
app.use(router)
app.mount('#app')
