import { vi } from 'vite-plus/test'

// @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
await import('../public/runtime/host-libraries.umd.js')

vi.mock('vue', () => window.$$lib$$.Vue)
vi.mock('naive-ui', () => window.$$lib$$.Naive)
vi.mock('vue-router', () => window.$$lib$$.VR)
vi.mock('vue-router/experimental', () => Object.assign({}, window.$$lib$$.VRExperimental))
vi.mock('pinia', () => window.$$lib$$.Pinia)
vi.mock('@pinia/colada', () => window.$$lib$$.Pc)
