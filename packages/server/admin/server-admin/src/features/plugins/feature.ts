import { defineAdminFeature } from '@/app/featureRegistry'

export default defineAdminFeature({
  key: 'plugins',
  navigation: { icon: 'plugins', label: '插件中心', order: 10, path: '/plugins' },
  routes: [
    {
      path: '/plugins',
      name: 'plugins',
      component: () => import('./PluginsPage.vue'),
      meta: { title: '插件中心' },
    },
  ],
})