import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import workspacePackage from '../../package.json'

const workspaceVersion = workspacePackage.version

const mocks = vi.hoisted(() => ({
  error: undefined as Error | undefined,
  execFile: vi.fn(),
  spawn: vi.fn(),
  statuses: [] as (number | null)[],
}))

vi.mock('node:child_process', () => ({ execFile: mocks.execFile, spawn: mocks.spawn }))

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
    mocks.statuses = Array.from({ length: 4 }, () => 0)
    const { publish } = await import('../semantic-release-plugin.mts')

    await publish({}, { env: {}, nextRelease: { version: workspaceVersion } })

    expect(mocks.spawn.mock.calls.slice(0, 3).map(([command, args]) => [command, args])).toEqual(
      ['@delta-comic/both', '@delta-comic/client', '@delta-comic/server'].map(name => [
        'vp',
        ['run', '--filter', name, '--fail-if-no-match', 'build'],
      ]),
    )
    expect(mocks.spawn).toHaveBeenNthCalledWith(
      4,
      'vp',
      [
        'pm',
        'publish',
        '-r',
        '--no-git-checks',
        '--tag',
        'latest',
        '--',
        '--registry=https://npm.pkg.github.com/',
        '--config.@delta-comic:registry=https://npm.pkg.github.com/',
      ],
      expect.objectContaining({ stdio: 'inherit' }),
    )
  })

  it.each([
    [1, 'Command failed (1): vp run --filter @delta-comic/both --fail-if-no-match build'],
    [null, 'Command failed (1): vp run --filter @delta-comic/both --fail-if-no-match build'],
  ] as const)('reports non-zero command status %s', async (status, message) => {
    mocks.statuses = [status]
    const { publish } = await import('../semantic-release-plugin.mts')

    await expect(
      publish({}, { env: {}, nextRelease: { version: workspaceVersion } }),
    ).rejects.toThrow(message)
    expect(mocks.spawn).toHaveBeenCalledOnce()
  })

  it('preserves spawn errors from the operating system', async () => {
    mocks.error = new Error('vp not found')
    const { publish } = await import('../semantic-release-plugin.mts')

    await expect(
      publish({}, { env: {}, nextRelease: { version: workspaceVersion } }),
    ).rejects.toThrow('vp not found')
  })
})