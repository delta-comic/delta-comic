import { uni } from '@delta-comic/model'
import { defineStore } from 'pinia'
import { markRaw, shallowReactive, type Raw } from 'vue'

export const useContentStore = defineStore('content', helper => {
  const history = shallowReactive(new Map<string, Raw<uni.content.ContentPage>>())
  const $createHistoryKey = helper.action(
    (contentType_: uni.content.ContentType_, id: string, ep: string) =>
      `${id}$${uni.content.ContentPage.contentPage.toString(contentType_)}$${ep}`,
    'createHistoryKey'
  )
  const $load = helper.action(
    (
      contentType_: uni.content.ContentType_,
      id: string,
      ep: string,
      preload?: uni.content.PreloadValue,
      load: boolean = true,
      _offline: boolean = false
    ) => {
      const itemId = $createHistoryKey(contentType_, id, ep)
      if (!history.has(itemId)) {
        var newIns = markRaw(
          new (uni.content.ContentPage.contentPage.get(contentType_)!)(preload, id, ep)
        )
        history.set(itemId, newIns)
        console.log('[useContentStore.$load] page cache miss', newIns)
      } else var newIns = history.get(itemId)!
      if (load) void newIns.loadAll()
    },
    'load'
  )
  return { history, $createHistoryKey, $load }
})