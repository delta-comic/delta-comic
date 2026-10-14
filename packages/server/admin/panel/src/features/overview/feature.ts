import { defineAdminFeature } from '@/app/featureRegistry'

export default defineAdminFeature({
  key: 'overview',
  navigation: { icon: 'home', label: '总览', order: 0, path: '/' },
  routes: [
    {
      path: '/',
      name: 'overview',
      component: () => import('./OverviewPage.vue'),
      meta: { title: '服务总览' },
    },
  ],
})