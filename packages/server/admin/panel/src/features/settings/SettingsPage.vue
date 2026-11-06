<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { shallowRef } from 'vue'

import { flowText } from '@/i18n/flows'
import { readableApiError } from '@/shared/api/AdminApiClient'
import PageHeader from '@/shared/components/PageHeader.vue'
import StatusMark from '@/shared/components/StatusMark.vue'
import { useConnectionStore } from '@/stores/connection'

const connection = useConnectionStore()
const { adminToken, apiBaseUrl, capabilities, error, isConnected, status, userToken } =
  storeToRefs(connection)
const { clearToken } = connection
const message = useMessage()
const endpointDraft = shallowRef(apiBaseUrl.value)
const tokenDraft = shallowRef(adminToken.value)
const userTokenDraft = shallowRef(userToken.value)
const saving = shallowRef(false)
const formError = shallowRef('')
const userTokenLabel = flowText.token

const save = async () => {
  saving.value = true
  formError.value = ''
  try {
    connection.saveCredentials(endpointDraft.value, tokenDraft.value)
    connection.saveUserToken(userTokenDraft.value)
    const connected = await connection.connect()
    if (connected) message.success('连接验证成功')
    else formError.value = error.value
  } catch (error) {
    formError.value = readableApiError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-page settings-page max-w-295">
    <PageHeader title="设置" description="管理 Server API 连接与当前浏览器会话" />

    <section
      class="settings-page__layout grid grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] gap-5.5 max-[840px]:grid-cols-1"
    >
      <NCard title="服务器连接" :bordered="true">
        <NForm label-placement="top" @submit.prevent="save">
          <NFormItem label="Server API 地址">
            <NInput
              v-model:value="endpointDraft"
              placeholder="https://delta-comic-server.example.workers.dev"
            />
          </NFormItem>
          <NFormItem label="管理员令牌">
            <NInput
              v-model:value="tokenDraft"
              type="password"
              show-password-on="click"
              placeholder="SERVER_ADMIN_TOKEN"
              autocomplete="current-password"
            />
          </NFormItem>
          <NFormItem :label="userTokenLabel">
            <NInput
              v-model:value="userTokenDraft"
              type="password"
              show-password-on="click"
              autocomplete="off"
            />
          </NFormItem>
          <NAlert class="mb-4" type="info" :show-icon="false">
            API 地址保存在 localStorage；管理员令牌只保存在当前标签页域的
            sessionStorage，关闭会话后不会长期保留。
          </NAlert>
          <div v-if="formError" class="admin-error settings-page__error my-4">
            {{ formError }}
          </div>
          <NSpace justify="end">
            <NButton v-if="adminToken" @click="clearToken">清除会话令牌</NButton>
            <NButton attr-type="submit" type="primary" :loading="saving">保存并验证</NButton>
          </NSpace>
        </NForm>
      </NCard>

      <NCard title="运行时能力" :bordered="true">
        <div class="settings-page__status mb-4.5">
          <StatusMark
            :label="isConnected ? '已认证' : '未认证'"
            :tone="isConnected ? 'success' : status === 'error' ? 'danger' : 'muted'"
          />
        </div>
        <template v-if="capabilities">
          <NDescriptions label-placement="left" :column="1" bordered size="small">
            <NDescriptionsItem label="服务">{{ capabilities.server.service }}</NDescriptionsItem>
            <NDescriptionsItem label="管理路径">{{
              capabilities.server.adminPath
            }}</NDescriptionsItem>
            <NDescriptionsItem label="运行模块">{{
              capabilities.modules.length
            }}</NDescriptionsItem>
            <NDescriptionsItem label="版本元数据">
              {{ capabilities.features.versionMetadata ? '可用' : '未绑定' }}
            </NDescriptionsItem>
          </NDescriptions>
        </template>
        <NEmpty v-else description="验证连接后显示服务端能力" />
      </NCard>
    </section>
  </div>
</template>