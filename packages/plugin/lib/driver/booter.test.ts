import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'

const mocks = vi.hoisted(() => {
  const plugins = new Map<string, unknown>()
  const ready = new Set<string>()
  return {
    booters: [] as any[],
    store: {
      $isLoaded: (plugin: string) => ready.has(plugin),
      $markLoading: vi.fn((plugin: string) => ready.delete(plugin)),
      $markReady: vi.fn((plugin: string) => ready.add(plugin)),
      $markUnloaded: vi.fn((plugin: string) => ready.delete(plugin)),
      plugins,
      ready,
    },
  }
})

vi.mock('./extensions', () => ({ runtimeExtensions: { booters: { values: mocks.booters } } }))
vi.mock('./store', () => ({ usePluginStore: () => mocks.store }))

import { bootPlugin } from './booter'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.booters.splice(0)
  mocks.store.plugins.clear()
  mocks.store.ready.clear()
})

describe('plugin booter pipeline', () => {
  it('runs booters in order and applies string/object progress reports', async () => {
    const first = {
      call: vi.fn(async (_config, report, environment) => {
        environment.token = 'shared'
        report('preparing')
      }),
      name: 'first',
    }
    const second = {
      call: vi.fn(async (_config, report, environment) => {
        expect(environment.token).toBe('shared')
        report({ description: 'ready', name: 'renamed' })
      }),
      name: 'second',
    }
    mocks.booters.push(first, second)
    const config = { name: 'fixture' }
    const progress = ref({
      fixture: {
        progress: { status: 'wait' as const, stepsIndex: 0 },
        steps: [{ description: 'waiting', name: 'waiting' }],
      },
    })

    await bootPlugin(config, progress)

    expect([...mocks.store.plugins.keys()]).toEqual(['fixture'])
    expect(mocks.store.$isLoaded('fixture')).toBe(true)
    expect(first.call).toHaveBeenCalledBefore(second.call)
    expect(progress.value.fixture.steps).toEqual([
      { description: 'waiting', name: 'waiting' },
      { description: 'preparing', name: 'first' },
      { description: 'ready', name: 'renamed' },
    ])
    expect(progress.value.fixture.progress).toEqual({ status: 'done', stepsIndex: 2 })
  })

  it('leaves the failing step visible and does not run later booters', async () => {
    const failure = new Error('booter failed')
    mocks.booters.push(
      { call: vi.fn(async () => Promise.reject(failure)), name: 'broken' },
      { call: vi.fn(), name: 'not-reached' },
    )
    const progress = ref({
      fixture: {
        progress: { status: 'wait' as const, stepsIndex: 0 },
        steps: [{ description: 'waiting', name: 'waiting' }],
      },
    })

    await expect(bootPlugin({ name: 'fixture' }, progress)).rejects.toBe(failure)

    expect(mocks.booters[1].call).not.toHaveBeenCalled()
    expect(mocks.store.$isLoaded('fixture')).toBe(false)
    expect(mocks.store.$markUnloaded).toHaveBeenCalledExactlyOnceWith('fixture')
    expect(progress.value.fixture.progress).toEqual({ status: 'process', stepsIndex: 1 })
  })

  it('invalidates the previous ready state before a reload starts', async () => {
    const progress = ref({
      fixture: {
        progress: { status: 'wait' as const, stepsIndex: 0 },
        steps: [{ description: 'waiting', name: 'waiting' }],
      },
    })

    await bootPlugin({ name: 'fixture' }, progress)
    expect(mocks.store.$isLoaded('fixture')).toBe(true)

    let finishBooter!: () => void
    const pendingBooter = new Promise<void>(resolve => (finishBooter = resolve))
    mocks.booters.push({ call: vi.fn(() => pendingBooter), name: 'pending' })

    const reload = bootPlugin({ name: 'fixture' }, progress)
    expect(mocks.store.$isLoaded('fixture')).toBe(false)

    finishBooter()
    await reload
    expect(mocks.store.$isLoaded('fixture')).toBe(true)
  })
})