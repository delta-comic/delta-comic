import type { StreamQuery, UniItem, UniItemAuthor } from '@delta-comic/model'

export interface Config {
  getUpdateList(
    olds: { author: UniItemAuthor; list: UniItem[] }[],
    signal: AbortSignal,
  ): PromiseLike<{ isUpdated: boolean; whichUpdated: UniItemAuthor[] }>
  onAdd?(author: UniItemAuthor): any
  onRemove?(author: UniItemAuthor): any
  fetchAuthorContent: StreamQuery<UniItem, { author: UniItemAuthor }>
}