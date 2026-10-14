import { i18n } from '@delta-comic/client-app-core/i18n/index'
import { usePluginStore } from '@delta-comic/client-core-plugin'
import { SharedFunction } from '@delta-comic/client-core-utils'
import { DcCell } from '@delta-comic/client-ui-ui'
import type { Component } from 'vue'

export type ThinkList = ({ text: string; value: string } | Component)[]

export const getBarcodeList = (searchText: string, signal: AbortSignal): Promise<ThinkList> => {
  const store = usePluginStore()
  const matched = [...store.content].flatMap(([plugin, content]) => {
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