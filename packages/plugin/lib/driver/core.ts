import { SharedFunction } from '@delta-comic/core'
import { db, DBUtils, SubscribeDB } from '@delta-comic/db'
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
    onBooted: () => {
      SharedFunction.define(
        async author => {
          const count = await DBUtils.countDb(
            db.value
              .selectFrom('subscribe')
              .where('key', '=', SubscribeDB.key.toString([author.$$plugin, author.label]))
          )

          return count > 0
        },
        coreName,
        'getIsAuthorSubscribe'
      )
      SharedFunction.define(
        async author => {
          await SubscribeDB.upsert({
            key: SubscribeDB.key.toString([author.$$plugin, author.label]),
            author,
            plugin: author.$$plugin,
            type: 'author',
            itemKey: null
          })
          return
        },
        coreName,
        'addAuthorSubscribe'
      )
      SharedFunction.define(
        async author => {
          await db.value
            .deleteFrom('subscribe')
            .where('key', '=', SubscribeDB.key.toString([author.$$plugin, author.label]))
            .execute()
          return
        },
        coreName,
        'removeAuthorSubscribe'
      )
    },
    share: {
      initiative: [
        {
          filter: () => true,
          icon: TagOutlined,
          key: 'token',
          name: '复制口令',
          async call(page) {
            const item = page.union.value!.toJSON()
            const compressed = compressToEncodedURIComponent(
              JSON.stringify(<CorePluginTokenShareMeta>{
                item: {
                  contentType: uni.content.ContentPage.contentPage.toString(item.contentType),
                  ep: item.thisEp.index,
                  name: item.title
                },
                plugin: page.plugin,
                id: page.id
              })
            )
            await SharedFunction.call(
              'pushShareToken',
              `[${page.union.value?.title}](复制这条口令，打开Delta Comic)${compressed}`
            )
          }
        },
        {
          filter: () => true,
          icon: OfflineShareRound,
          key: 'native',
          name: '原生分享',
          async call(page) {
            const item = page.union.value!.toJSON()
            const compressed = compressToEncodedURIComponent(
              JSON.stringify(<CorePluginTokenShareMeta>{
                item: {
                  contentType: uni.content.ContentPage.contentPage.toString(item.contentType),
                  ep: item.thisEp.index,
                  name: item.title
                },
                plugin: page.plugin,
                id: page.id
              })
            )
            const token = `[${page.union.value?.title}](复制这条口令，打开Delta Comic)${compressed}`
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
                  meta.item.contentType,
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