import './index.css'
import {
  type GlobalThemeOverrides,
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  zhCN,
} from 'naive-ui'
import { createPinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'

import App from './App.vue'
import { router } from './router'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#135fe8',
    primaryColorHover: '#2d72ee',
    primaryColorPressed: '#0e4fc4',
    primaryColorSuppl: '#135fe8',
  },
}

const app = createApp(
  defineComponent(
    () => () =>
      h(
        NConfigProvider,
        { locale: zhCN, themeOverrides },
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