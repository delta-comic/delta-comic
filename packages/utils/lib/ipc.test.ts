import { describe, expect, it, vi } from 'vite-plus/test'

import './test/setup'

declare module './ipc' {
  interface SharedFunctions {
    double(value: number): number | Promise<number>
    format(value: string): string
  }
}

describe('SharedFunction', () => {
  it('registers functions and calls every implementation by name', async () => {
    const { SharedFunction } = await import('./ipc')

    SharedFunction.define(value => value * 2, 'first', 'double')
    SharedFunction.define(async value => value * 3, 'second', 'double')

    const calls = SharedFunction.call('double', 4)

    expect(calls).toHaveLength(2)
    expect(calls.map(call => call.plugin)).toEqual(['first', 'second'])
    expect(calls[0].result).toBe(8)
    expect(await calls[1].result).toBe(12)
  })

  it('calls functions registered by a specific plugin', async () => {
    const { SharedFunction } = await import('./ipc')

    SharedFunction.define(value => `a:${value}`, 'a', 'format')
    SharedFunction.define(value => `b:${value}`, 'b', 'format')

    const calls = SharedFunction.callWitch('format', 'b', 'text')

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ plugin: 'b', result: 'b:text' })
  })

  it('calls the only registered random implementation and errors when none exist', async () => {
    const { Logger } = await import('@delta-comic/logger')
    const log = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})
    const { SharedFunction } = await import('./ipc')

    SharedFunction.define(value => `only:${value}`, 'only', 'format')

    expect(SharedFunction.callRandom('format', 'text')).toMatchObject({
      plugin: 'only',
      result: 'only:text',
    })
    expect(() => SharedFunction.callRandom('double', 1)).toThrow(
      '[SharedFunction.callRandom] call double, but not resigner any function.',
    )
    expect(log).toHaveBeenCalledWith('random shared function selected', {
      candidateCount: 1,
      index: 0,
      name: 'format',
      plugin: 'only',
    })
  })

  it('throws when calling a specific plugin without a registered function', async () => {
    const { SharedFunction } = await import('./ipc')

    expect(() => SharedFunction.callWitch('format', 'missing', 'text')).toThrow(
      '[SharedFunction.callWitch] not found plugin function (plugin: missing, name: format)',
    )
  })
})