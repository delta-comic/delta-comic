import { TagOutlined } from '@vicons/antd'
import { OfflineShareRound } from '@vicons/material'
import { definePlugin, Store, uni, Utils } from 'delta-comic-core'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

import CommentRow from '@/components/comment/commentRow.vue'
import Index from '@/components/comment/index.vue'
import FavouriteSelect from '@/components/favouriteSelect.vue'
import UnitCard from '@/components/unitCard.vue'
import AuthorIcon from '@/components/user/authorIcon.vue'
import { db, DBUtils, useNativeStore } from '@/db'
import { SubscribeDB } from '@/db/subscribe'
import { pluginName } from '@/symbol'

import { usePluginStore } from './store'
export const $initCore = () =>
  definePlugin({
    name: pluginName,
    config: [Store.appConfig],
    onBooted: () => {
      Utils.eventBus.SharedFunction.define(
        async author => {
          const count = await DBUtils.countDb(
            db.value
              .selectFrom('subscribe')
              .where('key', '=', SubscribeDB.key.toString([author.$$plugin, author.label]))
          )

          return count > 0
        },
        pluginName,
        'getIsAuthorSubscribe'
      )
      Utils.eventBus.SharedFunction.define(
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
        pluginName,
        'addAuthorSubscribe'
      )
      Utils.eventBus.SharedFunction.define(
        async author => {
          await db.value
            .deleteFrom('subscribe')
            .where('key', '=', SubscribeDB.key.toString([author.$$plugin, author.label]))
            .execute()
          return
        },
        pluginName,
        'removeAuthorSubscribe'
      )
      return {
        comp: {
          Comment: Index,
          ItemCard: UnitCard,
          FavouriteSelect: FavouriteSelect,
          CommentRow: CommentRow,
          AuthorIcon: AuthorIcon
        },
        db,
        useNativeStore
      }
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
            await Utils.eventBus.SharedFunction.call(
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
                return Utils.eventBus.SharedFunction.call(
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
    },
    search: {}
  })
interface CorePluginTokenShareMeta {
  item: { name: string; contentType: string; ep: string }
  plugin: string
  id: string
}