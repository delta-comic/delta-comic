import { uni, Utils, type PluginConfigSearchMethod } from 'delta-comic-core'
import { Cell } from 'vant'

import { usePluginStore } from '@/plugin/store'

export type ThinkList = Awaited<ReturnType<PluginConfigSearchMethod['getAutoComplete']>>

export const getBarcodeList = (searchText: string, signal: AbortSignal): Promise<ThinkList> => {
  const store = usePluginStore()
  const flattedAll = Array.from(uni.content.ContentPage.barcode.entries())
  const matched = flattedAll.map(v => [v[0], v[1].filter(b => b.match(searchText))] as const)
  return Promise.all(
    matched.flatMap(r =>
      r[1].map(i => (
        <Cell
          title={`转至${i.name}`}
          onClick={async () =>
            Utils.eventBus.SharedFunction.call(
              'routeToContent',
              ...(await i.getContent(searchText, signal))
            )
          }
          label={`来源:${store.$getPluginDisplayName(r[0])}`}
          value={searchText}
          class='van-haptics-feedback w-full'
        />
      ))
    )
  )
}