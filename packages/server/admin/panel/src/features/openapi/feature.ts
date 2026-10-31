import type { AdminFeature } from '@/app/featureRegistry'

export default {
  key: 'openapi',
  navigation: { icon: 'api', label: 'OpenAPI', order: 40, path: '/openapi' },
  routes: [
    {
      path: '/openapi',
      name: 'openapi',
      component: () => import('./OpenApiPage.vue'),
      meta: { title: 'OpenAPI' },
    },
  ],
} satisfies AdminFeature