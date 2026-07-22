import { describe, expect, it, vi } from 'vite-plus/test'

import { EpisodePaginationError, loadContentEpisodes } from './loadContentEpisodes'

const episode = (id: string) => ({ id, name: id }) as never

describe('loadContentEpisodes', () => {
  it('loads every page and removes duplicate episode ids', async () => {
    const query = vi.fn(async (_input: object, page: number, signal?: AbortSignal) => ({
      data: page === 1 ? [episode('one'), episode('shared')] : [episode('shared'), episode('two')],
      nextPage: page === 1 ? 2 : undefined,
      signal,
    }))
    const signal = new AbortController().signal

    await expect(
      loadContentEpisodes({ fetchEps: { initPage: 1, query } as never }, signal),
    ).resolves.toMatchObject([{ id: 'one' }, { id: 'shared' }, { id: 'two' }])
    expect(query).toHaveBeenNthCalledWith(1, {}, 1, signal)
    expect(query).toHaveBeenNthCalledWith(2, {}, 2, signal)
  })

  it('rejects a repeated cursor instead of polling forever', async () => {
    const query = vi.fn(async () => ({ data: [], nextPage: 'same' }))

    await expect(
      loadContentEpisodes(
        { fetchEps: { initPage: 'same', query } as never },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(EpisodePaginationError)
    expect(query).toHaveBeenCalledOnce()
  })

  it('stops before querying when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const query = vi.fn()

    await expect(
      loadContentEpisodes({ fetchEps: { initPage: 0, query } as never }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(query).not.toHaveBeenCalled()
  })
})