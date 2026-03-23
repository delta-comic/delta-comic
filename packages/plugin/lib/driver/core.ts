import { SharedFunction } from '@delta-comic/core'
import { uni } from '@delta-comic/model'
import { useGlobalVar } from '@delta-comic/utils'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

import { appConfig } from '@/config'
import { declareDepType } from '@/depends'
import { definePlugin, type PluginExpose } from '@/plugin'

import { OfflineShareRound, TagOutlined } from './icon'
import { usePluginStore } from './store'
export const $initCore = () =>
  definePlugin({
    name: coreName,
    config: [appConfig],
    share: {
      initiative: [
        {
          filter: page => !!page.preload,
          icon: TagOutlined,
          key: 'token',
          name: '复制口令',
          async call(page) {
            const item = page.preload?.toJSON()
            if (!item) throw new Error('Not found preload in content. Maybe not fetch detail?')

            const compressed = compressToEncodedURIComponent(
              JSON.stringify(<CorePluginTokenShareMeta>{
                item: {
                  contentType: uni.content.ContentPage.contentPages.key.toString(item.contentType),
                  ep: item.thisEp.id,
                  name: item.title
                },
                plugin: page.plugin,
                id: page.id
              })
            )
            await SharedFunction.call(
              'pushShareToken',
              `[${item.title}](复制这条口令，打开Delta Comic)${compressed}`
            )
          }
        },
        {
          filter: page => !!page.preload,
          icon: OfflineShareRound,
          key: 'native',
          name: '原生分享',
          async call(page) {
            const item = page.preload?.toJSON()
            if (!item) throw new Error('Not found preload in content. Maybe not fetch detail?')

            const compressed = compressToEncodedURIComponent(
              JSON.stringify(<CorePluginTokenShareMeta>{
                item: {
                  contentType: uni.content.ContentPage.contentPages.key.toString(item.contentType),
                  ep: item.thisEp.id,
                  name: item.title
                },
                plugin: page.plugin,
                id: page.id
              })
            )
            const token = `[${item.title}](复制这条口令，打开Delta Comic)${compressed}`
            await navigator.share({ title: 'Delta Comic内容分享', text: token })
          }
        }
      ],
      tokenListen: [
        {
          key: 'token',
          name: '默认口令',
          patten(chipboard) {
            return /^\[.+\]\(复制这条口令，打开Delta Comic\).+/.test(chipboard)
          },
          show(chipboard) {
            const pluginStore = usePluginStore()
            const meta: CorePluginTokenShareMeta = JSON.parse(
              decompressFromEncodedURIComponent(
                chipboard.replace(/^\[.+\]/, '').replaceAll('(复制这条口令，打开Delta Comic)', '')
              )
            )
            return {
              title: '口令',
              detail: `发现分享的内容: ${meta.item.name}，需要的插件: ${pluginStore.$getPluginDisplayName(meta.plugin)}`,
              onNegative() {},
              onPositive() {
                return SharedFunction.call(
                  'routeToContent',
                  uni.content.ContentPage.contentPages.key.toJSON(meta.item.contentType),
                  meta.id,
                  meta.item.ep
                )
              }
            }
          }
        }
      ]
    }
  })
interface CorePluginTokenShareMeta {
  item: { name: string; contentType: string; ep: string }
  plugin: string
  id: string
}

export const coreName = 'core'
export const core = useGlobalVar(
  declareDepType<PluginExpose<typeof $initCore>>(coreName),
  'core/plugin/coreFlag'
)