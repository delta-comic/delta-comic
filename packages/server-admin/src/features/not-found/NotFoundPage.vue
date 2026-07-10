<template>
  <div class="dc-page">
    <NResult status="404" title="页面不存在" description="请选择左侧已注册的管理功能。">
      <template #footer
        ><NButton type="primary" @click="$router.push('/')">返回总览</NButton></template
      >
    </NResult>
  </div>
</template>