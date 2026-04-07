import { createDialog, createForm, DcPopup } from '@delta-comic/ui'
import { Mutex } from 'es-toolkit'
import { defineComponent, h, markRaw, ref } from 'vue'

import { usePluginStore } from '@/driver/store'
import { Global } from '@/global'
import type { Auth, PluginConfig } from '@/plugin'

import { PluginBooter, type PluginBooterSetMeta } from '../utils'

const authPopupMutex = new Mutex()
class _PluginAuth extends PluginBooter {
  public override name = '登录'
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    if (!cfg.auth) return
    const pluginStore = usePluginStore()
    try {
      const pluginName = pluginStore.$getPluginDisplayName(cfg.name)
      setMeta('判定鉴权状态中...')
      const isPass = await cfg.auth.passSelect()
      const waitMethod = Promise.withResolvers<'logIn' | 'signUp'>()
      console.log(`[plugin auth] ${pluginName}, isPass: ${isPass}`)
      await authPopupMutex.acquire()
      setMeta('等待其他插件鉴权结束...')
      if (!isPass) {
        setMeta('选择鉴权方式')
        void createDialog({
          type: 'default',
          positiveText: '登录',
          negativeText: '注册',
          closable: false,
          maskClosable: false,
          content: '选择鉴权方式',
          title: pluginName,
          onNegativeClick() {
            waitMethod.resolve('signUp')
          },
          onPositiveClick() {
            waitMethod.resolve('logIn')
          }
        })
      } else {
        setMeta('跳过鉴权方式选择')
        waitMethod.resolve(isPass)
      }
      const method = await waitMethod.promise
      setMeta('鉴权中...')
      const by: Auth.Method = {
        async form(form) {
          const formInstance = createForm(form)
          Global.globalNodes.push(
            markRaw(
              defineComponent(() => {
                const show = ref(true)
                void formInstance.data.then(() => (show.value = false))
                return () =>
                  h(
                    DcPopup as any,
                    {
                      show: show.value,
                      position: 'center',
                      round: true,
                      class: 'auth-popup',
                      transitionAppear: true
                    },
                    [h('div', [pluginName]), formInstance.comp]
                  )
              })
            )
          )
          const data = await formInstance.data
          return data
        },
        website(_url) {
          return window
        }
      }
      if (method == 'logIn') {
        await cfg.auth.logIn(by)
      } else if (method == 'signUp') {
        await cfg.auth.signUp(by)
      }
      authPopupMutex.release()
      setMeta('鉴权成功')
    } catch (error: any) {
      setMeta(`登录失败: ${error}`)
      throw error
    }
  }
}
export default new _PluginAuth()