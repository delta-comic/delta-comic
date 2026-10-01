import { defineAdminFeature } from '@/app/featureRegistry'

export default defineAdminFeature({
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
})