import { SharedFunction } from '@delta-comic/core'
import { Global, type Search, usePluginStore } from '@delta-comic/plugin'
import { Cell } from 'vant'

export type ThinkList = Awaited<ReturnType<Search.SearchMethod['getAutoComplete']>>

export const getBarcodeList = (searchText: string, signal: AbortSignal): Promise<ThinkList> => {
  const store = usePluginStore()
  const flattedAll = Array.from(Global.barcode.entries())
  const matched = flattedAll.map(v => [v[0], v[1].filter(b => b.match(searchText))] as const)
  return Promise.all(
    matched.flatMap(r =>
      r[1].map(i => (
        <Cell
          title={`转至${i.name}`}
          onClick={async () =>
            SharedFunction.call('routeToContent', ...(await i.getContent(searchText, signal)))
          }
          label={`来源:${store.$getPluginDisplayName(r[0])}`}
          value={searchText}
          class='van-haptics-feedback w-full'
        />
      ))
    )
  )
}