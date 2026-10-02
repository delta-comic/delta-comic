import type { UniItemAuthor } from '@delta-comic/model'

export interface SocialHooks {
  onSubscribeOne?(author: UniItemAuthor): void
  onUnsubscribeOne?(author: UniItemAuthor): void
}