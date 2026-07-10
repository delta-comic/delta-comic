import { defineAdminFeature } from '@/app/featureRegistry'

export default defineAdminFeature({
  key: 'observability',
  navigation: { icon: 'metrics', label: '运行指标', order: 20, path: '/observability' },
  routes: [
    {
      path: '/observability',
      name: 'observability',
      component: () => import('./ObservabilityPage.vue'),
      meta: { title: '运行指标' },
    },
  ],
})