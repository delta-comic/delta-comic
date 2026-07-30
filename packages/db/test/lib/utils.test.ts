import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  setAccessMode: vi.fn(),
  setIsolationLevel: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../../lib', () => ({ db: { transaction: mocks.transaction } }))

import { countDb, withTransition } from '../../lib/utils'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockReturnValue({ setAccessMode: mocks.setAccessMode })
  mocks.setAccessMode.mockReturnValue({ setIsolationLevel: mocks.setIsolationLevel })
  mocks.setIsolationLevel.mockReturnValue({ execute: mocks.execute })
  mocks.execute.mockImplementation(async (handler: (trx: unknown) => unknown) =>
    handler({ id: 'generated-transaction' }),
  )
})

describe('database utility transactions', () => {
  it('uses a supplied transaction without opening a nested one', async () => {
    const trx = { id: 'existing' }
    const handler = vi.fn(async (received: typeof trx) => received.id)

    await expect(withTransition(handler as never, trx as never)).resolves.toBe('existing')

    expect(handler).toHaveBeenCalledExactlyOnceWith(trx)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('opens an explicit read-write, read-committed transaction when absent', async () => {
    const handler = vi.fn(async (trx: { id: string }) => trx.id)

    await expect(withTransition(handler as never)).resolves.toBe('generated-transaction')

    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.setAccessMode).toHaveBeenCalledExactlyOnceWith('read write')
    expect(mocks.setIsolationLevel).toHaveBeenCalledExactlyOnceWith('read committed')
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(handler)
  })
})

describe('countDb', () => {
  it('selects a count alias and returns its numeric value', async () => {
    const as = vi.fn(() => 'count-expression')
    const countAll = vi.fn(() => ({ as }))
    const executeTakeFirstOrThrow = vi.fn(async () => ({ count: 42 }))
    const select = vi.fn((callback: (db: any) => unknown) => {
      expect(callback({ fn: { countAll } })).toBe('count-expression')
      return { executeTakeFirstOrThrow }
    })

    await expect(countDb({ select } as never)).resolves.toBe(42)

    expect(countAll).toHaveBeenCalledOnce()
    expect(as).toHaveBeenCalledExactlyOnceWith('count')
    expect(executeTakeFirstOrThrow).toHaveBeenCalledOnce()
  })
})