import { UniContentPage } from '@delta-comic/model'
import { SharedFunction } from '@delta-comic/utils'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

import { pluginI18n, pluginMessageKey } from '../adapters'
import type { Social } from '../api'

interface CorePluginTokenShareMeta {
  item: { name: string; contentType: string; ep: string }
  plugin: string
  id: string
}

export const tokenInit: Social.InitiativeItem = {
  filter: page => !!page.preload,
  icon: {},
  key: 'token',
  name: pluginMessageKey('plugin.share.copyToken'),
  async call(page) {
    const item = page.preload?.toJSON()
    if (!item) throw new Error('Not found preload in content. Maybe not fetch detail?')

    const compressed = compressToEncodedURIComponent(
      JSON.stringify(<CorePluginTokenShareMeta>{
        item: {
          contentType: UniContentPage.contentPages.key.toString(item.contentType),
          ep: item.thisEp.id,
          name: item.title,
        },
        plugin: page.plugin,
        id: page.id,
      }),
    )
    return { token: `[${item.title}](复制这条口令，打开Delta Comic)${compressed}` }
  },
}

export const nativeInit: Social.InitiativeItem = {
  filter: page => !!page.preload,
  icon: {},
  key: 'native',
  name: pluginMessageKey('plugin.share.native'),
  async call(page) {
    const item = page.preload?.toJSON()
    if (!item) throw new Error('Not found preload in content. Maybe not fetch detail?')

    const compressed = compressToEncodedURIComponent(
      JSON.stringify(<CorePluginTokenShareMeta>{
        item: {
          contentType: UniContentPage.contentPages.key.toString(item.contentType),
          ep: item.thisEp.id,
          name: item.title,
        },
        plugin: page.plugin,
        id: page.id,
      }),
    )
    const token = `[${item.title}](复制这条口令，打开Delta Comic)${compressed}`
    await navigator.share({ title: pluginI18n.translate('plugin.share.nativeTitle'), text: token })

    return { token }
  },
}

export const tokenShare: Social.ShareToken = {
  key: 'token',
  name: pluginMessageKey('plugin.share.defaultToken'),
  isMatched(chipboard) {
    return /^\[.+\]\(复制这条口令，打开Delta Comic\).+/.test(chipboard)
  },
  async show(chipboard) {
    // const pluginStore = usePluginStore()
    const meta: CorePluginTokenShareMeta = JSON.parse(
      decompressFromEncodedURIComponent(
        chipboard.replace(/^\[.+\]/, '').replaceAll('(复制这条口令，打开Delta Comic)', ''),
      ),
    )
    return {
      title: pluginI18n.translate('plugin.share.tokenTitle'),
      detail: pluginI18n.translate('plugin.share.tokenDetail', { item: meta.item.name }),
      onNegative() {},
      onPositive() {
        return SharedFunction.call(
          'routeToContent',
          UniContentPage.contentPages.key.toJSON(meta.item.contentType),
          meta.id,
          meta.item.ep,
        )
      },
    }
  },
}