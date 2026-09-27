import { createRouter, createWebHistory } from 'vue-router'

import { featureRoutes } from '@/app/featureRegistry'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...featureRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/features/not-found/NotFoundPage.vue'),
      meta: { title: '页面不存在' },
    },
  ],
  scrollBehavior: () => ({ left: 0, top: 0 }),
})

router.afterEach(route => {
  const title = typeof route.meta.title === 'string' ? route.meta.title : '管理面板'
  document.title = `${title} · Delta Comic Server`
})