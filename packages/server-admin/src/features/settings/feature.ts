import { defineAdminFeature } from '@/app/featureRegistry'

export default defineAdminFeature({
  key: 'settings',
  navigation: { icon: 'gear', label: '设置', order: 50, path: '/settings' },
  routes: [
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./SettingsPage.vue'),
      meta: { title: '连接设置' },
    },
  ],
})