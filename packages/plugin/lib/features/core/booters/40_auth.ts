import { createForm } from '@delta-comic/ui'
import { PageWebviewAuth } from '@delta-comic/utils'
import { Mutex } from 'es-toolkit'
import { NModal, useDialog } from 'naive-ui'
import { defineComponent, h, markRaw, ref } from 'vue'

import { usePluginStore } from '@/driver/store'
import { Global } from '@/global'
import { pluginI18n, pluginMessageKey } from '@/i18n'
import type { Auth, PluginConfig } from '@/plugin'

import { PluginBooter, type PluginBooterSetMeta } from '../../../driver/extensionTypes'

const authPopupMutex = new Mutex()

class _PluginAuth extends PluginBooter {
  public override name = pluginMessageKey('plugin.runtime.steps.auth.title')
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    if (!cfg.auth) return
    const pluginStore = usePluginStore()
    let mutexAcquired = false
    try {
      const pluginName = pluginStore.$getI18nName(cfg.name)
      setMeta(pluginMessageKey('plugin.runtime.steps.auth.checking'))
      const isPass = await cfg.auth.passSelect()
      const waitMethod = Promise.withResolvers<'logIn' | 'signUp'>()
      console.log(`[plugin auth] ${pluginName}, isPass: ${isPass}`)
      await authPopupMutex.acquire()
      mutexAcquired = true
      setMeta(pluginMessageKey('plugin.runtime.steps.auth.waiting'))
      if (!isPass) {
        setMeta(pluginMessageKey('plugin.runtime.steps.auth.selecting'))
        void useDialog().create({
          type: 'default',
          positiveText: pluginI18n.translate('plugin.runtime.steps.auth.logIn'),
          negativeText: pluginI18n.translate('plugin.runtime.steps.auth.signUp'),
          closable: false,
          maskClosable: false,
          content: pluginI18n.translate('plugin.runtime.steps.auth.selectMethod'),
          title: pluginName,
          onNegativeClick() {
            waitMethod.resolve('signUp')
          },
          onPositiveClick() {
            waitMethod.resolve('logIn')
          },
        })
      } else {
        setMeta(pluginMessageKey('plugin.runtime.steps.auth.skipping'))
        waitMethod.resolve(isPass)
      }
      const method = await waitMethod.promise
      setMeta(pluginMessageKey('plugin.runtime.steps.auth.authenticating'))
      const by: Auth.Method = {
        async form(form) {
          const formInstance = createForm(form)
          Global.addGlobalNode(
            markRaw(
              defineComponent(() => {
                const show = ref(true)
                void formInstance.data.then(() => (show.value = false))
                return () =>
                  h(
                    NModal,
                    { show: show.value, position: 'center', preset: 'dialog', title: pluginName },
                    formInstance.comp,
                  )
              }),
            ),
            cfg.name,
          )
          const data = await formInstance.data
          return data
        },
        async website<T>(
          url: string,
          injectCode: Auth.InjectCode,
        ): Promise<Auth.CallbackResult<T>> {
          const auth = new PageWebviewAuth<T>(url, injectCode, { title: pluginName })
          return auth.mount()
        },
      }
      if (method == 'logIn') {
        await cfg.auth.logIn(by)
      } else if (method == 'signUp') {
        await cfg.auth.signUp(by)
      }
      authPopupMutex.release()
      mutexAcquired = false
      setMeta(pluginMessageKey('plugin.runtime.steps.auth.success'))
    } catch (error: any) {
      if (mutexAcquired) authPopupMutex.release()
      setMeta(pluginI18n.translate('plugin.runtime.steps.auth.failure', { error: String(error) }))
      throw error
    }
  }
}
export default new _PluginAuth()