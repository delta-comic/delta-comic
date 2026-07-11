<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { shallowRef } from 'vue'

import PageHeader from '@/shared/components/PageHeader.vue'
import StatusMark from '@/shared/components/StatusMark.vue'
import { useConnectionStore } from '@/stores/connection'

const connection = useConnectionStore()
const message = useMessage()
const endpointDraft = shallowRef(connection.apiBaseUrl)
const tokenDraft = shallowRef(connection.adminToken)
const saving = shallowRef(false)
const formError = shallowRef('')

const save = async () => {
  saving.value = true
  formError.value = ''
  try {
    connection.saveCredentials(endpointDraft.value, tokenDraft.value)
    const connected = await connection.connect()
    if (connected) message.success('连接验证成功')
    else formError.value = connection.error
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="dc-page settings-page">
    <PageHeader title="设置" description="管理 Server API 连接与当前浏览器会话" />

    <section class="settings-page__layout">
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
          <NAlert type="info" :show-icon="false" style="margin-bottom: 1rem">
            API 地址保存在 localStorage；管理员令牌只保存在当前标签页域的
            sessionStorage，关闭会话后不会长期保留。
          </NAlert>
          <div v-if="formError" class="dc-error-banner settings-page__error">{{ formError }}</div>
          <NSpace justify="end">
            <NButton v-if="connection.adminToken" @click="connection.clearToken">
              清除会话令牌
            </NButton>
            <NButton attr-type="submit" type="primary" :loading="saving">保存并验证</NButton>
          </NSpace>
        </NForm>
      </NCard>

      <NCard title="运行时能力" :bordered="true">
        <div class="settings-page__status">
          <StatusMark
            :label="connection.isConnected ? '已认证' : '未认证'"
            :tone="
              connection.isConnected
                ? 'success'
                : connection.status === 'error'
                  ? 'danger'
                  : 'muted'
            "
          />
        </div>
        <template v-if="connection.capabilities">
          <NDescriptions label-placement="left" :column="1" bordered size="small">
            <NDescriptionsItem label="服务">{{
              connection.capabilities.server.service
            }}</NDescriptionsItem>
            <NDescriptionsItem label="管理路径">{{
              connection.capabilities.server.adminPath
            }}</NDescriptionsItem>
            <NDescriptionsItem label="运行模块">{{
              connection.capabilities.modules.length
            }}</NDescriptionsItem>
            <NDescriptionsItem label="版本元数据">
              {{ connection.capabilities.features.versionMetadata ? '可用' : '未绑定' }}
            </NDescriptionsItem>
          </NDescriptions>
        </template>
        <NEmpty v-else description="验证连接后显示服务端能力" />
      </NCard>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  @apply [max-width:1180px];
  @apply [margin:0_auto];
}

.settings-page__layout {
  @apply [display:grid];
  @apply [grid-template-columns:minmax(0,_1.25fr)_minmax(300px,_0.75fr)];
  @apply [gap:22px];
}

.settings-page__error {
  @apply [margin:16px_0];
}

.settings-page__status {
  @apply [margin-bottom:18px];
}

@media (max-width: 840px) {
  .settings-page__layout {
    @apply [grid-template-columns:1fr];
  }
}
</style>