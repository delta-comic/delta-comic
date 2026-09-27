import { usePluginStore } from '@delta-comic/plugin'
import { DcCell } from '@delta-comic/ui'
import { SharedFunction } from '@delta-comic/utils'
import type { Component } from 'vue'

import { i18n } from '@/i18n'

export type ThinkList = ({ text: string; value: string } | Component)[]

export const getBarcodeList = (searchText: string, signal: AbortSignal): Promise<ThinkList> => {
  const store = usePluginStore()
  const matched = store.modelEntries('content').flatMap(([plugin, content]) => {
    const search = content.search
    if (!search) return []
    return (search.barcode ?? []).flatMap(barcode =>
      search.methods.flatMap(method => {
        const aim = { input: searchText, search: { method: method.id, sort: method.sorts.default } }
        return barcode.isMatch(aim) ? [{ aim, barcode, plugin }] : []
      }),
    )
  })
  return Promise.resolve(
    matched.map(({ aim, barcode, plugin }) => (
      <DcCell
        title={barcode.getTipText(aim)}
        onClick={() => {
          if (!signal.aborted)
            void SharedFunction.call(
              'routeToSearch',
              aim.input,
              [plugin, aim.search.method],
              aim.search.sort,
            )
        }}
        label={i18n.global.t('search.sourceLabel', { source: store.displayName(plugin) })}
        value={searchText}
        class='w-full dc-interactive'
      />
    )),
  )
}