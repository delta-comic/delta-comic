import { describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  registerBooter: vi.fn(),
  registerInstaller: vi.fn(),
  registerLoader: vi.fn(),
}))

vi.mock('../../../../lib/driver/extensions', () => ({
  registerBooter: mocks.registerBooter,
  registerInstaller: mocks.registerInstaller,
  registerLoader: mocks.registerLoader,
}))

vi.mock('../../../../lib/features/core/booters/0_configSetter', () => ({
  default: { id: 'config' },
}))
vi.mock('../../../../lib/features/core/booters/5_i18n', () => ({ default: { id: 'i18n' } }))
vi.mock('../../../../lib/features/core/booters/10_apiTest', () => ({ default: { id: 'api' } }))
vi.mock('../../../../lib/features/core/booters/20_resourceTest', () => ({
  default: { id: 'resource' },
}))
vi.mock('../../../../lib/features/core/booters/30_boot', () => ({ default: { id: 'boot' } }))
vi.mock('../../../../lib/features/core/booters/40_auth', () => ({ default: { id: 'auth' } }))
vi.mock('../../../../lib/features/core/booters/50_otherProcess', () => ({
  default: { id: 'other' },
}))
vi.mock('../../../../lib/features/core/installers/10_normalUrl', () => ({ default: { id: 'url' } }))
vi.mock('../../../../lib/features/core/installers/20_local', () => ({ default: { id: 'local' } }))
vi.mock('../../../../lib/features/core/installers/30_dev', () => ({
  default: { id: 'dev-installer' },
}))
vi.mock('../../../../lib/features/core/installers/40_github', () => ({ default: { id: 'github' } }))
vi.mock('../../../../lib/features/core/installers/9999_awesome', () => ({
  default: { id: 'awesome' },
}))
vi.mock('../../../../lib/features/core/loaders/1_zip', () => ({ default: { id: 'zip' } }))
vi.mock('../../../../lib/features/core/loaders/2_dev', () => ({ default: { id: 'dev-loader' } }))

describe('core runtime extension registration', () => {
  it('registers every built-in extension in deterministic order exactly once', async () => {
    vi.resetModules()
    const { registerCoreRuntimeExtensions } = await import('../../../../lib/features/core/runtime')

    registerCoreRuntimeExtensions()
    registerCoreRuntimeExtensions()

    expect(
      mocks.registerBooter.mock.calls.map(([value, options]) => [value.id, options.order]),
    ).toEqual([
      ['config', 0],
      ['i18n', 5],
      ['api', 10],
      ['resource', 20],
      ['boot', 30],
      ['auth', 40],
      ['other', 50],
    ])
    expect(
      mocks.registerLoader.mock.calls.map(([value, options]) => [value.id, options.order]),
    ).toEqual([
      ['zip', 1],
      ['dev-loader', 2],
    ])
    expect(
      mocks.registerInstaller.mock.calls.map(([value, options]) => [value.id, options.order]),
    ).toEqual([
      ['url', 10],
      ['local', 20],
      ['dev-installer', 30],
      ['github', 40],
      ['awesome', 9999],
    ])
  })
})