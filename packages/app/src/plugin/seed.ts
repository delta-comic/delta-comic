import * as client from '@delta-comic/client'
import { hostModuleIds } from '@delta-comic/platform/manifest'
import * as colada from '@pinia/colada'
import * as cordis from 'cordis'
import * as naive from 'naive-ui'
import * as pinia from 'pinia'
import * as vue from 'vue'
import * as router from 'vue-router'
import * as experimental from 'vue-router/experimental'

const namespaces = {
  vue,
  cordis,
  pinia,
  '@pinia/colada': colada,
  'naive-ui': naive,
  'vue-router': router,
  'vue-router/experimental': experimental,
  '@delta-comic/client': client,
} satisfies Record<(typeof hostModuleIds)[number], object>
export const hostSeed = new Map(Object.entries(namespaces))