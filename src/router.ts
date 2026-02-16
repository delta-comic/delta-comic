import { M3 } from 'tauri-plugin-m3'
import { toRef } from 'vue'
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
import { SharedFunction } from '@delta-comic/core'
import { uni } from '@delta-comic/model'
import { useConfig } from '@delta-comic/plugin'
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
        contentType: uni.content.ContentPage.contentPage.toString(contentType_)
      }
    })
  },
  pluginName,
  'routeToContent'
)
SharedFunction.define(
  (input, source, sort) => {
    return router.force.push({
      name: '/search/[input]',
      params: { input: encodeURI(input) },
      query: { source: source ? searchSourceKey.toString(source) : undefined, sort: sort }
    })
  },
  pluginName,
  'routeToSearch'
)

const $routerForceDo = async (mode: keyof typeof router.force, to: RouteLocationRaw) => {
  do var r = await router[mode](to)
  while (isNavigationFailure(r, NavigationFailureType.aborted))
  return r
}
router.force = {
  push: to => $routerForceDo('push', to),
  replace: to => $routerForceDo('replace', to)
}

router.beforeEach(async to => {
  const isDark = useConfig().isDark
  if (to.meta.statusBar) {
    const sb = toRef(to.meta.statusBar).value
    if (sb == 'auto') {
      await M3.setBarColor(isDark ? 'dark' : 'light')
    } else !sb ? await M3.setBarColor(sb) : undefined
  } else {
    await M3.setBarColor(!isDark ? 'dark' : 'light')
  }
  return true
})

//@ts-ignore
if (import.meta.hot) {
  handleHotUpdate(router)
}