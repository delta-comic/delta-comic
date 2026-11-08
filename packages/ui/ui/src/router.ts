import type { DeltaRouter } from '@delta-comic/utils'
import {
  createRouter,
  createWebHistory,
  isNavigationFailure,
  NavigationFailureType,
  type _RouterClassic,
  type RouteLocationRaw,
} from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'

export const router = (window.$router = Object.assign(
  createRouter({ history: createWebHistory(), routes }),
  {
    force: { push: to => $routerForceDo('push', to), replace: to => $routerForceDo('replace', to) },
  } as Pick<DeltaRouter, 'force'>,
) as DeltaRouter & _RouterClassic)

router.beforeEach(to => {
  if (to.name === '/' || to.name === '//component' || to.path === '/component/list') {
    return '/component/dc-cell'
  }
})

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

if (import.meta.hot) {
  handleHotUpdate(router)
}