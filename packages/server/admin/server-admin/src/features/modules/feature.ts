import { defineAdminFeature } from '@/app/featureRegistry'

export default defineAdminFeature({
  key: 'modules',
  navigation: { icon: 'cube', label: '服务模块', order: 30, path: '/modules' },
  routes: [
    {
      path: '/modules/:key?',
      name: 'modules',
      component: () => import('./ModulesPage.vue'),
      meta: { title: '服务模块' },
    },
  ],
})