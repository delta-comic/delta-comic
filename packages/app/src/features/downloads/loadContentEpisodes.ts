import type { uni } from '@delta-comic/model'
import type { PageKey } from '@delta-comic/model'

export class EpisodePaginationError extends Error {
  constructor(message = 'episode pagination returned a repeated cursor') {
    super(message)
    this.name = 'EpisodePaginationError'
  }
}

function pageIdentity(page: PageKey) {
  return `${typeof page}:${String(page)}`
}

export async function loadContentEpisodes(
  page: Pick<uni.content.ContentPage, 'fetchEps'>,
  signal: AbortSignal,
  maxPages = 1000,
): Promise<uni.ep.Ep[]> {
  const episodes = new Map<string, uni.ep.Ep>()
  const visitedPages = new Set<string>()
  let pageKey = page.fetchEps.initPage

  for (let pageCount = 0; pageCount < maxPages; pageCount += 1) {
    signal.throwIfAborted()
    const identity = pageIdentity(pageKey)
    if (visitedPages.has(identity)) throw new EpisodePaginationError()
    visitedPages.add(identity)

    const result = await page.fetchEps.query({}, pageKey, signal)
    for (const episode of result.data) episodes.set(episode.id, episode)
    if (result.nextPage == null) return [...episodes.values()]
    pageKey = result.nextPage
  }

  throw new EpisodePaginationError(`episode pagination exceeded ${maxPages} pages`)
}