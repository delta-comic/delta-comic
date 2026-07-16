import { uni } from '@delta-comic/model'
import { useConfig } from '@delta-comic/plugin'
import { SharedFunction } from '@delta-comic/utils'
import type { DeltaRouter } from '@delta-comic/utils'
import { toValue } from 'vue'
import {
  createRouter,
  createWebHashHistory,
  isNavigationFailure,
  NavigationFailureType,
  type _RouterClassic,
  type RouteLocationAsPathGeneric,
  type RouteLocationAsRelativeGeneric,
} from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'

import { searchSourceKey } from '@/components/search/source'
import { setStatusBar } from '@/platform'
import { useContentStore } from '@/stores/content'
import { pluginName } from '@/symbol'

type RouteAim = string | RouteLocationAsRelativeGeneric | RouteLocationAsPathGeneric

export const router = (window.$router = Object.assign(
  // The main app is hosted by main.html in both native windows and the web iframe.
  createRouter({ history: createWebHashHistory(), routes }),
  {
    force: { push: to => $routerForceDo('push', to), replace: to => $routerForceDo('replace', to) },
  } as Pick<DeltaRouter, 'force'>,
) as DeltaRouter & _RouterClassic)

SharedFunction.define(
  (contentType_, id, ep, preload) => {
    const contentStore = useContentStore()
    contentStore.$load(contentType_, id, ep, preload)
    return router.force.push({
      name: '/content/[contentType]/[id]/[ep]',
      params: {
        id: encodeURI(id),
        ep: encodeURI(ep),
        contentType: uni.content.ContentPage.contentPages.key.toString(contentType_),
      },
    })
  },
  pluginName,
  'routeToContent',
)
SharedFunction.define(
  (input, source, sort) => {
    return router.force.push({
      name: '/search/[keyword]/[sort]/[method]',
      params: {
        keyword: encodeURI(input),
        method: encodeURI(source ? searchSourceKey.toString(source) : 'unknown'),
        sort: encodeURI(sort ?? 'unknown'),
      },
    })
  },
  pluginName,
  'routeToSearch',
)

const $routerForceDo = async (mode: keyof typeof router.force, to: RouteAim) => {
  const aim = router.resolve(to as any)
  aim.query.force = 'true'
  let attempts = 0
  let r
  do {
    if (attempts++ > 20) throw new Error('Navigation retry exceeded 20 attempts')
    r = await router[mode](aim)
  } while (isNavigationFailure(r, NavigationFailureType.aborted))
  return r
}

router.beforeEach(async to => {
  const isDark = useConfig().isDark
  if (to.meta.statusBar) {
    const sb = toValue(to.meta.statusBar)
    if (sb == 'auto') await setStatusBar(isDark ? 'dark' : 'light')
    else if (sb) await setStatusBar(sb)
    return true
  }
  await setStatusBar(!isDark ? 'dark' : 'light')
  return true
})

if (import.meta.hot) {
  handleHotUpdate(router)
}