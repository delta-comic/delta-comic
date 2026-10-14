import { configureCoreHost } from '@delta-comic/client-app-core'
import { config } from '@vue/test-utils'
import { vi } from 'vite-plus/test'

// @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
await import('../public/runtime/host-libraries.umd.js')
const { vaporInteropPlugin } = window.$$lib$$.Vue
config.global.plugins = [vaporInteropPlugin]

vi.mock('vue', () => window.$$lib$$.Vue)
vi.mock('naive-ui', () => window.$$lib$$.Naive)
vi.mock('vue-router', () => window.$$lib$$.VR)
vi.mock('vue-router/experimental', () => Object.assign({}, window.$$lib$$.VRExperimental))
vi.mock('pinia', () => window.$$lib$$.Pinia)
vi.mock('@pinia/colada', () => window.$$lib$$.Pc)
configureCoreHost({
  platform: {
    isNative: () => false,
    openExternal: async url => (await import('../src/platform')).openExternal(url),
    listenResume: async () => () => {},
  },
  navigation: { hasRoute: () => false, addRoute: () => () => {}, removeRoute: () => {} },
  ui: {
    warning: () => {},
    createDownloadMessage: async () => {
      throw new Error('Unexpected download dialog')
    },
  },
})