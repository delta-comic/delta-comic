import { logger } from '@delta-comic/logger'
import { UniContentPage, type UniContentType_, type UniItem } from '@delta-comic/model'
import { defineStore } from 'pinia'
import { markRaw, shallowReactive, type Raw } from 'vue'

const contentLogger = logger.scoped('app:content')

export const useContentStore = defineStore('content', helper => {
  const history = shallowReactive(new Map<string, Raw<UniContentPage>>())
  const $createHistoryKey = helper.action(
    (contentType_: UniContentType_, id: string, ep: string) =>
      `${id}$${UniContentPage.contentPages.key.toString(contentType_)}$${ep}`,
    'createHistoryKey',
  )
  const $load = helper.action(
    (contentType_: UniContentType_, id: string, ep: string, preload?: UniItem | undefined) => {
      const itemId = $createHistoryKey(contentType_, id, ep)
      if (!history.has(itemId)) {
        var newIns = markRaw(new (UniContentPage.contentPages.get(contentType_)!)(preload, id, ep))
        history.set(itemId, newIns)
        contentLogger.debug('content page cache miss', { contentType: contentType_, id, ep })
      } else var newIns = history.get(itemId)!
    },
    'load',
  )
  return { history, $createHistoryKey, $load }
})