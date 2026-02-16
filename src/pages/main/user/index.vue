<script setup lang="ts">
import { db, DBUtils } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { useConfig, usePluginStore } from '@delta-comic/plugin'
import { DcVar } from '@delta-comic/ui'
import { FolderOutlined } from '@vicons/antd'
import { computedAsync } from '@vueuse/core'
import { isEmpty } from 'es-toolkit/compat'
import { useRouter } from 'vue-router'
const $router = useRouter()
const config = useConfig()
const $window = window
const pluginStore = usePluginStore()

const favouriteCount = computedAsync(() => DBUtils.countDb(db.value.selectFrom('favouriteItem')), 0)
const subscribesCount = computedAsync(() => DBUtils.countDb(db.value.selectFrom('subscribe')), 0)
</script>

<template>
  <div class="w-full bg-(--van-background-2) pt-safe"></div>
  <div class="flex h-10 w-full items-center justify-end bg-(--van-background-2)">
    <VanIcon color="var(--van-text-color-2)" class="mx-2">
      <svg
        v-if="config.isDark"
        xmlns="http://www.w3.org/2000/svg"
        class="w-7"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        class="w-7"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 24 24"
      >
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4"></circle>
          <path
            d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7l-.7.7m0 11.4l.7.7m-12.1-.7l-.7.7"
          ></path>
        </g>
      </svg>
    </VanIcon>
  </div>
  <template v-for="[plugin, user] of uni.user.User.userBase">
    <DcVar :value="pluginStore.plugins.get(plugin)?.user?.card" v-slot="{ value }">
      <component
        :is="value"
        v-if="value"
        :user
        isSmall
        @click="$router.force.push({ name: '/user/edit/[plugin]', params: { plugin } })"
      />
    </DcVar>
  </template>
  <div
    v-if="isEmpty(uni.user.User.userBase)"
    class="flex h-20 w-full items-center justify-center bg-(--van-background-2)"
  >
    <span class="text-(--van-text-color-2) italic">没有已注册的用户信息</span>
  </div>
  <VanRow
    class="h-16 w-full bg-(--van-background-2) py-2 *:*:flex *:*:flex-col *:*:items-center *:*:justify-center *:*:*:first:text-lg *:*:*:last:text-xs *:*:*:last:text-(--van-text-color-2)"
  >
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
  <div
    class="h-[calc(100%-2.5rem-5rem-4rem)] w-full overflow-y-auto bg-(--van-background-2) text-xs!"
  >
    <div class="flex h-20 w-full items-center justify-around">
      <div
        @click="$router.push('/user/download')"
        class="van-haptics-feedback flex flex-col items-center justify-center"
      >
        <NIcon name="photo-o" size="2rem" color="var(--bili-blue)">
          <FolderOutlined />
        </NIcon>
        <span class="mt-1 text-(--van-text-color)">本地缓存</span>
      </div>
      <div
        @click="$router.push('/user/history')"
        class="van-haptics-feedback flex flex-col items-center justify-center"
      >
        <VanIcon name="clock-o" size="2rem" color="var(--bili-blue)" />
        <span class="mt-1 text-(--van-text-color)">历史记录</span>
      </div>
      <div
        @click="$router.push('/user/favourite')"
        class="van-haptics-feedback flex flex-col items-center justify-center"
      >
        <VanIcon name="star-o" size="2rem" color="var(--bili-blue)" />
        <span class="mt-1 text-(--van-text-color)">我的收藏</span>
      </div>
      <div
        @click="$router.push('/user/recent')"
        class="van-haptics-feedback flex flex-col items-center justify-center"
      >
        <NIcon size="1.9rem" color="var(--bili-blue)">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 32 32"
          >
            <path d="M20.59 22L15 16.41V7h2v8.58l5 5.01L20.59 22z" fill="currentColor"></path>
            <path
              d="M16 2A13.94 13.94 0 0 0 6 6.23V2H4v8h8V8H7.08A12 12 0 1 1 4 16H2A14 14 0 1 0 16 2z"
              fill="currentColor"
            ></path>
          </svg>
        </NIcon>
        <span class="mt-1 text-(--van-text-color)">稍后再看</span>
      </div>
    </div>
    <template v-for="[pluginName, plugin] of pluginStore.plugins.entries()">
      <ActionCard :pluginName v-for="card of plugin.user?.userActionPages ?? []" :card />
    </template>
    <VanCell title="设置" is-link @click="$router.force.push({ name: '/setting' })" />
    <VanCell title="青少年模式" @click="$window.close()" is-link />
  </div>
</template>
<style scoped lang="css">
:deep(.n-statistic__label),
:deep(.n-statistic-value) {
  text-align: center;
}
</style>