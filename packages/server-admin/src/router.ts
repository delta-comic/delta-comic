import { createRouter, createWebHistory } from 'vue-router'

import DashboardPage from '@/pages/DashboardPage.vue'
import ModulesPage from '@/pages/ModulesPage.vue'
import OpenApiPage from '@/pages/OpenApiPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardPage, name: 'dashboard' },
    { path: '/modules/:key', component: ModulesPage, name: 'modules' },
    { path: '/openapi', component: OpenApiPage, name: 'openapi' },
  ],
})
