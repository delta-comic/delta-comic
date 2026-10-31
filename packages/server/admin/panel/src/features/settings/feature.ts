import type { AdminFeature } from '@/app/featureRegistry'

export default {
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
} satisfies AdminFeature