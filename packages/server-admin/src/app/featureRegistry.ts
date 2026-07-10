import type { RouteRecordRaw } from 'vue-router'

import type { AppIconName } from '@/shared/components/types'

export interface AdminFeatureNavigation {
  icon: AppIconName
  label: string
  order: number
  path: string
}

export interface AdminFeature {
  key: string
  navigation?: AdminFeatureNavigation
  routes: RouteRecordRaw[]
}

const rawFeatures = import.meta.glob<{ default: AdminFeature }>('../features/*/feature.ts', {
  eager: true,
})

export const adminFeatures = Object.values(rawFeatures)
  .map(module => module.default)
  .sort((left, right) => (left.navigation?.order ?? 999) - (right.navigation?.order ?? 999))

export const featureNavigation = adminFeatures
  .flatMap(feature => (feature.navigation ? [feature.navigation] : []))
  .sort((left, right) => left.order - right.order)

export const featureRoutes = adminFeatures.flatMap(feature => feature.routes)

export function defineAdminFeature<const Feature extends AdminFeature>(feature: Feature): Feature {
  return feature
}