import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  error: undefined as Error | undefined,
  spawn: vi.fn(),
  statuses: [] as (number | null)[],
}))

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.error = undefined
  mocks.statuses = []
  mocks.spawn.mockImplementation(() => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const child = {
      on(event: string, listener: (...args: any[]) => void) {
        listeners.set(event, listener)
        if (event === 'close') {
          queueMicrotask(() => {
            if (mocks.error) listeners.get('error')?.(mocks.error)
            else listener(mocks.statuses.length === 0 ? 0 : mocks.statuses.shift())
          })
        }
        return child
      },
    }
    return child
  })
})

describe('semantic-release command runner', () => {
  it('runs ordered package builds and recursive publish through inherited stdio', async () => {
    mocks.statuses = [0, 0, 0, 0, 0, 0, 0]
    const { publish } = await import('./semantic-release-plugin.mts')

    await publish({}, { env: {}, nextRelease: { version: '2.3.0' } })

    expect(mocks.spawn).toHaveBeenNthCalledWith(
      1,
      'vp',
      ['run', '--filter', '@delta-comic/model', '--fail-if-no-match', 'build'],
      expect.objectContaining({ stdio: 'inherit' }),
    )
    expect(mocks.spawn).toHaveBeenNthCalledWith(
      3,
      'vp',
      ['run', '--filter', '@delta-comic/downloader', '--fail-if-no-match', 'build'],
      expect.objectContaining({ stdio: 'inherit' }),
    )
    expect(mocks.spawn).toHaveBeenNthCalledWith(
      7,
      'vp',
      ['pm', 'publish', '-r', '--no-git-checks', '--provenance', '--tag', 'latest'],
      expect.objectContaining({ stdio: 'inherit' }),
    )
  })

  it.each([
    [1, 'Command failed (1): vp run --filter @delta-comic/model --fail-if-no-match build'],
    [null, 'Command failed (1): vp run --filter @delta-comic/model --fail-if-no-match build'],
  ] as const)('reports non-zero command status %s', async (status, message) => {
    mocks.statuses = [status]
    const { publish } = await import('./semantic-release-plugin.mts')

    await expect(publish({}, { env: {}, nextRelease: { version: '2.3.0' } })).rejects.toThrow(
      message,
    )
    expect(mocks.spawn).toHaveBeenCalledOnce()
  })

  it('preserves spawn errors from the operating system', async () => {
    mocks.error = new Error('vp not found')
    const { publish } = await import('./semantic-release-plugin.mts')

    await expect(publish({}, { env: {}, nextRelease: { version: '2.3.0' } })).rejects.toThrow(
      'vp not found',
    )
  })
})