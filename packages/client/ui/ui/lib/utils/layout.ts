import { tryOnUnmounted } from '@vueuse/core'
import { remove } from 'es-toolkit'
import { watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'

const preventIndexMap = new Array<Ref<boolean>>()

/**
 * @description
 * isShow为真时会阻止替换路由返回。
 * 同时还会自动处理force路由
 */
export const usePreventBack = (isShow: Ref<boolean>) => {
  const $router = window.$router ?? useRouter()

  const isLast = () => preventIndexMap.at(-1) === isShow

  const watcher = watch(
    isShow,
    val => {
      if (val) preventIndexMap.push(isShow)
      else remove(preventIndexMap, v => v == isShow)
    },
    { immediate: true },
  )

  const stopRouter = $router.beforeEach(to => {
    const isForce = to.query['force'] == 'true'

    if (isForce || (isLast() && isShow.value)) {
      isShow.value = false
      preventIndexMap.pop()
      return true
    }

    return true
  })

  tryOnUnmounted(() => {
    stopRouter()
    watcher()
  })
  return stopRouter
}