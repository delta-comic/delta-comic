<script setup lang='ts'>
import { DBUtils, db } from '@/db'
import { usePluginStore } from '@/plugin/store'
import { FolderOutlined } from '@vicons/antd'
import { computedAsync } from '@vueuse/core'
import { Comp, uni, Store } from 'delta-comic-core'
import { isEmpty } from 'es-toolkit/compat'
import { useRouter } from 'vue-router'
const $router = useRouter()
const config = Store.useConfig()
const $window = window
const pluginStore = usePluginStore()

const favouriteCount = computedAsync(() => DBUtils.countDb(db.value.selectFrom('favouriteItem')), 0)
const subscribesCount = computedAsync(() => DBUtils.countDb(db.value.selectFrom('subscribe')), 0)
</script>

<template>
  <div class="w-full pt-safe bg-(--van-background-2)"></div>
  <div class="w-full h-10 flex justify-end items-center bg-(--van-background-2)">
    <VanIcon color="var(--van-text-color-2)" class="mx-2">
      <svg v-if="config.isDark" xmlns="http://www.w3.org/2000/svg" class="w-7"
        xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
        <path d="M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-7" xmlns:xlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 24 24">
        <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7l-.7.7m0 11.4l.7.7m-12.1-.7l-.7.7"></path>
        </g>
      </svg>
    </VanIcon>
  </div>
  <template v-for="[plugin, user] of uni.user.User.userBase">
    <Comp.Var :value="pluginStore.plugins.get(plugin)?.user?.card" v-slot="{ value }">
      <component :is="value" v-if="value" :user isSmall @click="$router.force.push(`/user/edit/${plugin}`)" />
    </Comp.Var>
  </template>
  <div v-if="isEmpty(uni.user.User.userBase)"
    class="w-full h-20 bg-(--van-background-2) flex justify-center items-center">
    <span class="text-(--van-text-color-2) italic">没有已注册的用户信息</span>
  </div>
  <VanRow
    class="w-full bg-(--van-background-2) h-16 *:*:flex *:*:flex-col *:*:justify-center *:*:items-center *:*:*:first:text-lg *:*:*:last:text-xs *:*:*:last:text-(--van-text-color-2) py-2">
    <VanCol span="8">
      <div class="van-hairline--right">
        <span>{{ favouriteCount }}</span>
        <span>收藏</span>
      </div>
    </VanCol>
    <VanCol span="8">
      <div>
        <span>{{ subscribesCount }}</span>
        <span>关注</span>
      </div>
    </VanCol>
    <VanCol span="8">
      <div class="van-hairline--left">
        <span>123</span>
        <span>获赞</span>
      </div>
    </VanCol>
  </VanRow>
  <div class="bg-(--van-background-2) text-xs! w-full h-[calc(100%-2.5rem-5rem-4rem)] overflow-y-auto">
    <div class="w-full h-20 flex justify-around items-center">
      <div @click="$router.push('/user/download')"
        class="flex flex-col justify-center items-center van-haptics-feedback">
        <NIcon name="photo-o" size="2rem" color="var(--bili-blue)">
          <FolderOutlined />
        </NIcon>
        <span class="mt-1 text-(--van-text-color)">本地缓存</span>
      </div>
      <div @click="$router.push('/user/history')"
        class="flex flex-col justify-center items-center van-haptics-feedback">
        <VanIcon name="clock-o" size="2rem" color="var(--bili-blue)" />
        <span class="mt-1 text-(--van-text-color)">历史记录</span>
      </div>
      <div @click="$router.push('/user/favourite')"
        class="flex flex-col justify-center items-center van-haptics-feedback">
        <VanIcon name="star-o" size="2rem" color="var(--bili-blue)" />
        <span class="mt-1 text-(--van-text-color)">我的收藏</span>
      </div>
      <div @click="$router.push('/user/recent')" class="flex flex-col justify-center items-center van-haptics-feedback">
        <NIcon size="1.9rem" color="var(--bili-blue)">
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32">
            <path d="M20.59 22L15 16.41V7h2v8.58l5 5.01L20.59 22z" fill="currentColor"></path>
            <path d="M16 2A13.94 13.94 0 0 0 6 6.23V2H4v8h8V8H7.08A12 12 0 1 1 4 16H2A14 14 0 1 0 16 2z"
              fill="currentColor"></path>
          </svg>
        </NIcon>
        <span class="mt-1 text-(--van-text-color)">稍后再看</span>
      </div>
    </div>
    <template v-for="[pluginName, plugin] of pluginStore.plugins.entries()">
      <ActionCard :pluginName v-for="card of plugin.user?.userActionPages ?? []" :card />
    </template>
    <VanCell title="设置" is-link @click="$router.force.push('/setting')" />
    <VanCell title="青少年模式" @click="$window.close()" is-link />
  </div>
</template>
<style scoped lang='css'>
:deep(.n-statistic__label),
:deep(.n-statistic-value) {
  text-align: center;
}
</style>