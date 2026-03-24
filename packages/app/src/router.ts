import { SharedFunction } from '@delta-comic/core'
import { uni } from '@delta-comic/model'
import { useConfig } from '@delta-comic/plugin'
import type {} from '@delta-comic/utils'
import { M3 } from 'tauri-plugin-m3'
import { toValue } from 'vue'
import {
  createRouter,
  createWebHistory,
  isNavigationFailure,
  NavigationFailureType,
  type RouteLocationRaw
} from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'

import { searchSourceKey } from '@/components/search/source'
import { useContentStore } from '@/stores/content'
import { pluginName } from '@/symbol'
export const router = (window.$router = createRouter({ history: createWebHistory(), routes }))

SharedFunction.define(
  (contentType_, id, ep, preload) => {
    const contentStore = useContentStore()
    contentStore.$load(contentType_, id, ep, preload)
    return router.force.push({
      name: '/content/[contentType]/[id]/[ep]',
      params: {
        id: encodeURI(id),
        ep: encodeURI(ep),
        contentType: uni.content.ContentPage.contentPages.key.toString(contentType_)
      }
    })
  },
  pluginName,
  'routeToContent'
)
SharedFunction.define(
  (input, source, sort) => {
    return router.force.push({
      name: '/search/[keyword]/[sort]/[method]',
      params: {
        keyword: encodeURI(input),
        method: encodeURI(source ? searchSourceKey.toString(source) : 'unknown'),
        sort: encodeURI(sort ?? 'unknown')
      }
    })
  },
  pluginName,
  'routeToSearch'
)

const $routerForceDo = async (mode: keyof typeof router.force, to: RouteLocationRaw) => {
  const aim = router.resolve(to)
  aim.query.force = 'true'
  let attempts = 0
  let r
  do {
    if (attempts++ > 20) throw new Error('Navigation retry exceeded 20 attempts')
    r = await router[mode](aim)
  } while (isNavigationFailure(r, NavigationFailureType.aborted))
  return r
}
router.force = {
  push: to => $routerForceDo('push', to),
  replace: to => $routerForceDo('replace', to)
}

router.beforeEach(async to => {
  const isDark = useConfig().isDark
  if (to.meta.statusBar) {
    const sb = toValue(to.meta.statusBar)
    if (sb == 'auto') await M3.setBarColor(isDark ? 'dark' : 'light')
    else !sb ? await M3.setBarColor(sb) : undefined
    return true
  }
  await M3.setBarColor(!isDark ? 'dark' : 'light')
  return true
})

if (import.meta.hot) {
  handleHotUpdate(router)
}