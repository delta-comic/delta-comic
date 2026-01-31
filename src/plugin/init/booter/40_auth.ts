import { _pluginExposes, Comp, Utils, type PluginConfig, type PluginConfigAuthMethod } from "delta-comic-core"
import { PluginBooter, type PluginBooterSetMeta } from "../utils"
import { Mutex } from "es-toolkit"
import { createForm } from "@/utils/createForm"
import { useAppStore } from "@/stores/app"
import { defineComponent, h, markRaw, ref } from "vue"
import { usePluginStore } from "@/plugin/store"


const authPopupMutex = new Mutex
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
        try {
          await Utils.message.createDialog({
            type: 'default',
            positiveText: '登录',
            negativeText: '注册',
            closable: false,
            maskClosable: false,
            content: '选择鉴权方式',
            title: pluginName
          })
          waitMethod.resolve('logIn')
        } catch {
          waitMethod.resolve('signUp')
        }
      } else {
        setMeta('跳过鉴权方式选择')
        waitMethod.resolve(isPass)
      }
      const method = await waitMethod.promise
      setMeta('鉴权中...')
      const by: PluginConfigAuthMethod = {
        async form(form) {
          const f = createForm(form)
          const store = useAppStore()
          store.renderRootNodes.push(markRaw(defineComponent(() => {
            const show = ref(true)
            f.data.then(() => show.value = false)
            return () => h(Comp.Popup, {
              show: show.value,
              position: 'center',
              round: true,
              class: 'p-6 pt-3 !w-[95vw]',
              transitionAppear: true
            }, [
              h('div', { class: 'pl-1 py-1 text-lg w-full' }, [pluginName]),
              f.comp
            ])
          })))
          const data = await f.data
          return data
        },
        website(_url) {
          return window
        },
      }
      if (method == 'logIn') {
        await cfg.auth.logIn(by)
      } else if (method == 'signUp') {
        await cfg.auth.signUp(by)
      }
      authPopupMutex.release()
      setMeta('鉴权成功')

    } catch (error) {
      setMeta(`登录失败: ${error}`)
      throw error
    }

  }
}
export default new _PluginAuth